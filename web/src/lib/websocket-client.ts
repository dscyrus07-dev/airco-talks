import { isServerMessage, type ClientMessage, type ServerMessage } from "@airco-talks/shared";

export type ServerMessageHandler = (message: ServerMessage) => void;
export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

/**
 * Thin, typed WebSocket client for the browser. Handles reconnection with
 * exponential backoff and validates every incoming message with the shared
 * Zod schema before dispatching (never trusts raw server frames).
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = "idle";
  private reconnectAttempts = 0;
  private manualClose = false;
  private readonly handlers = new Set<ServerMessageHandler>();
  private readonly statusHandlers = new Set<(s: ConnectionStatus) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly url: string) {}

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.manualClose = false;
    this.setStatus(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus("connected");
    };

    ws.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(typeof event.data === "string" ? event.data : "");
      } catch {
        return;
      }
      if (!isServerMessage(parsed)) return; // drop invalid frames
      for (const h of this.handlers) h(parsed);
    };

    ws.onclose = () => {
      this.setStatus("disconnected");
      if (!this.manualClose) this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will follow and trigger reconnect.
    };
  }

  send(message: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.manualClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    if (this.ws) {
      this.ws.close(1000, "client disconnect");
      this.ws = null;
    }
    this.setStatus("idle");
  }

  onMessage(handler: ServerMessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onStatus(handler: (s: ConnectionStatus) => void): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= 10) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 8000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const h of this.statusHandlers) h(status);
  }
}
