import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { AddressInfo } from "node:net";
import {
  parseClientMessage,
  type ClientMessage,
  type ServerMessage,
} from "@airco-talks/shared";

import type { VoiceConversationOrchestrator } from "../../application/voice-conversation-orchestrator.js";
import type { EventBus } from "../../domain/event-bus.js";
import type { ILogger } from "../../domain/interfaces/logger.js";
import type { VoiceEventName } from "../../domain/events/voice-events.js";
import { ValidationError } from "../errors/typed-errors.js";

export interface WebSocketServerDeps {
  orchestrator: VoiceConversationOrchestrator;
  eventBus: EventBus;
  logger: ILogger;
  port: number;
  allowedOrigins: string[];
  /** Optional real provider readiness probe, surfaced via GET /health. */
  providerHealth?: () => Promise<Record<string, boolean>>;
}

/**
 * Backend WebSocket server. One connection per browser client. It:
 *  - validates every incoming message with Zod (never trusts external input),
 *  - routes client messages to the orchestrator,
 *  - subscribes to orchestrator events once and forwards them to the right
 *    client by sessionId.
 */
export class AircoTalksWebSocketServer {
  private wss: WebSocketServer | null = null;
  private httpServer: http.Server | null = null;
  /** sessionId → client socket, for routing server events back to the browser. */
  private readonly connections = new Map<string, WebSocket>();
  private readonly unsubscribers: Array<() => void> = [];

  constructor(private readonly deps: WebSocketServerDeps) {}

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = http.createServer((req, res) => {
        // Health data is non-sensitive (provider readiness booleans) and is
        // fetched cross-origin by the web app, so allow any origin for GETs.
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        if (req.url?.startsWith("/health") && this.deps.providerHealth) {
          void this.deps
            .providerHealth()
            .then((providers) =>
              res.end(JSON.stringify({ service: "Airco Talks", status: "ok", providers })),
            )
            .catch(() => res.end(JSON.stringify({ service: "Airco Talks", status: "ok" })));
          return;
        }
        res.end(JSON.stringify({ service: "Airco Talks", status: "ok" }));
      });

      this.wss = new WebSocketServer({
        server: this.httpServer,
        verifyClient: (info: { origin: string; secure: boolean; req: import("node:http").IncomingMessage }) =>
          this.verifyClient(info),
      });

      this.wss.on("connection", (socket) => this.onConnection(socket));

      this.httpServer.listen(this.deps.port, () => {
        const addr = this.httpServer?.address() as AddressInfo | null;
        this.deps.logger.info("WebSocket server listening", { port: addr?.port });
        this.subscribeEvents();
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
    for (const [, socket] of this.connections) {
      socket.close(1001, "server shutting down");
    }
    this.connections.clear();
    await new Promise<void>((resolve) => {
      this.wss?.close(() => resolve());
    });
    this.httpServer?.close();
  }

  private verifyClient(info: { origin: string; secure: boolean; req: import("node:http").IncomingMessage }): boolean {
    // Allow same-origin dev (no origin) or any of the configured web origins.
    if (!info.origin) return true;
    try {
      const incoming = new URL(info.origin).origin;
      const isLocalhost = (u: URL) => u.hostname === "localhost" || u.hostname === "127.0.0.1";
      const allowed = this.deps.allowedOrigins.some((allowedOrigin) => {
        const origin = new URL(allowedOrigin).origin;
        return incoming === origin || (isLocalhost(new URL(origin)) && isLocalhost(new URL(incoming)));
      });
      if (!allowed) {
        this.deps.logger.warn("WebSocket connection rejected: origin not allowed", {
          origin: info.origin,
          allowedOrigins: this.deps.allowedOrigins,
        });
      }
      return allowed;
    } catch {
      return false;
    }
  }

  private onConnection(socket: WebSocket): void {
    const pendingId = crypto.randomUUID();
    this.deps.logger.debug("client connected", { pendingId });

    socket.on("message", (raw) => this.onMessage(socket, pendingId, raw.toString()));
    socket.on("close", () => this.onClose(pendingId));
    socket.on("error", (err) => this.deps.logger.warn("socket error", { pendingId, err: err.message }));
  }

  private async onMessage(socket: WebSocket, pendingId: string, raw: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.send(socket, { type: "error", code: "INVALID_JSON", message: "Malformed JSON", recoverable: true });
      return;
    }

    let message: ClientMessage;
    try {
      message = parseClientMessage(parsed);
    } catch (err) {
      this.send(socket, {
        type: "error",
        code: "VALIDATION_ERROR",
        message: err instanceof Error ? err.message : "Invalid message",
        recoverable: true,
      });
      return;
    }

    try {
      switch (message.type) {
        case "start_session": {
          const sessionId = message.sessionId ?? crypto.randomUUID();
          this.connections.set(sessionId, socket);
          await this.deps.orchestrator.startSession(
            sessionId,
            message.myLanguage,
            message.theirLanguage,
            message.voice,
          );
          break;
        }
        case "audio_chunk": {
          const data = Buffer.from(message.data, "base64");
          await this.deps.orchestrator.handleAudioChunk(message.sessionId, new Uint8Array(data));
          break;
        }
        case "interrupt":
          await this.deps.orchestrator.interrupt(message.sessionId);
          break;
        case "update_config":
          await this.deps.orchestrator.updateConfig(
            message.sessionId,
            message.myLanguage,
            message.theirLanguage,
            message.voice,
          );
          break;
        case "stop_session":
          await this.deps.orchestrator.stopSession(message.sessionId);
          this.connections.delete(message.sessionId);
          break;
      }
    } catch (err) {
      const sessionId = "sessionId" in message ? message.sessionId : undefined;
      this.deps.logger.error("message handling failed", { sessionId, err: String(err) });
      this.send(socket, {
        type: "error",
        sessionId,
        code: err instanceof ValidationError ? err.code : "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Internal error",
        recoverable: true,
      });
    }
  }

  private async onClose(pendingId: string): Promise<void> {
    // Find the session(s) bound to this socket and clean up.
    for (const [sessionId, socket] of this.connections) {
      if (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
        this.connections.delete(sessionId);
        await this.deps.orchestrator.stopSession(sessionId).catch(() => undefined);
      }
    }
    void pendingId;
  }

  // ── event → client message routing ────────────────────────

  private subscribeEvents(): void {
    const bus = this.deps.eventBus;
    const route = (sessionId: string, msg: ServerMessage) => {
      const socket = this.connections.get(sessionId);
      if (socket && socket.readyState === WebSocket.OPEN) this.send(socket, msg);
    };

    type Handler<E extends VoiceEventName> = (p: import("../../domain/events/voice-events.js").VoiceEventPayload<E>) => void;

    const on = <E extends VoiceEventName>(event: E, fn: Handler<E>) => {
      this.unsubscribers.push(bus.on(event, fn as never));
    };

    on("voice_session_started", (p) => route(p.sessionId, { type: "session_started", sessionId: p.sessionId }));
    on("state_changed", (p) => route(p.sessionId, { type: "state_changed", sessionId: p.sessionId, state: p.to }));
    on("transcript_partial", (p) => route(p.sessionId, { type: "transcript_partial", sessionId: p.sessionId, text: p.text, language: p.language, side: p.side }));
    on("transcript_final", (p) => route(p.sessionId, { type: "transcript_final", sessionId: p.sessionId, text: p.text, language: p.language, confidence: p.confidence, side: p.side }));
    on("language_detected", (p) => route(p.sessionId, { type: "language_detected", sessionId: p.sessionId, language: p.language, confidence: p.confidence }));
    on("ai_response_started", (p) => route(p.sessionId, { type: "ai_response_started", sessionId: p.sessionId, side: p.side }));
    on("ai_response_chunk", (p) => route(p.sessionId, { type: "ai_response_chunk", sessionId: p.sessionId, text: p.text }));
    on("ai_response_completed", (p) => route(p.sessionId, { type: "ai_response_completed", sessionId: p.sessionId, text: p.text, language: p.language, side: p.side }));
    on("tts_chunk", (p) => route(p.sessionId, { type: "audio_chunk", sessionId: p.sessionId, data: p.data, sampleRate: p.sampleRate }));
    on("ai_speech_ended", (p) => route(p.sessionId, { type: "ai_speech_ended", sessionId: p.sessionId }));
    on("latency", (p) => route(p.sessionId, { type: "latency", sessionId: p.sessionId, speechEndToFirstAudioMs: p.speechEndToFirstAudioMs, llmFirstTokenMs: p.llmFirstTokenMs, ttsFirstAudioMs: p.ttsFirstAudioMs }));
    on("provider_error", (p) => route(p.sessionId, { type: "error", sessionId: p.sessionId, code: p.code, message: p.message, recoverable: p.recoverable }));
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}
