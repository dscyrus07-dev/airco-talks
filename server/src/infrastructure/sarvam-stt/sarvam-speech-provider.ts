import WebSocket from "ws";
import type { LanguageCode } from "@dhvani/shared";
import type {
  SpeechRecognitionProvider,
  StartSpeechSessionOptions,
  AudioChunk,
  SpeechRecognitionHandlers,
  SttLanguage,
  ProviderErrorEvent,
} from "../../domain/interfaces/speech-recognition-provider.js";
import { SpeechProviderError } from "../errors/typed-errors.js";

interface SarvamRealtimeEvent {
  event: string;
  text?: string;
  language_code?: string;
  language?: string;
  language_probability?: number;
  code?: string | number;
  is_fatal?: boolean;
  message?: string;
  [key: string]: unknown;
}

/**
 * Sarvam Saaras v3-realtime streaming STT over WebSocket.
 *
 * Protocol (verified against Sarvam docs, Aug 2026):
 *  - Endpoint: wss://api.sarvam.ai/speech-to-text-realtime/ws
 *  - Auth: Api-Subscription-Key header
 *  - Query: language_code (BCP-47 or "auto"), model=saaras:v3-realtime,
 *           stream_type, endpointing=vad, encoding=linear16, sample_rate, VAD tuning
 *  - Client sends: {"event":"audio_input","audio":"<base64>"} and {"event":"end"}
 *  - Server events: transcript.partial, transcript.final, error (+ optional vad.*)
 *  - Mid-call reconfig: {"event":"config.update","language_code":"<auto|locale>"}
 */
export class SarvamSpeechProvider implements SpeechRecognitionProvider {
  readonly name = "sarvam-stt";

  private ws: WebSocket | null = null;
  private handlers: SpeechRecognitionHandlers = {};
  private currentLanguage: SttLanguage = "auto";
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.sarvam.ai") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async startSession(options: StartSpeechSessionOptions): Promise<void> {
    this.currentLanguage = options.language;
    this.handlers = options.handlers;

    const params = new URLSearchParams({
      model: "saaras:v3-realtime",
      language_code: options.language,
      stream_type: "fast",
      endpointing: "vad",
      encoding: "linear16",
      sample_rate: String(options.sampleRate),
      silence_duration_ms: "500",
      min_speech_duration_ms: "250",
      threshold: "0.3",
    });
    const url = `${this.baseUrl.replace("https://", "wss://")}/speech-to-text-realtime/ws?${params}`;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url, [], { headers: { "Api-Subscription-Key": this.apiKey } });
      this.ws = ws;

      ws.on("open", () => {
        this.handlers.onConnectionStateChange?.("connected");
        resolve();
      });

      ws.on("message", (raw: WebSocket.RawData) => this.onMessage(raw));

      ws.on("error", (err) => {
        const event: ProviderErrorEvent = {
          code: "STT_WS_ERROR",
          message: err.message,
          recoverable: true,
          provider: this.name,
        };
        this.handlers.onError?.(event);
        if (ws.readyState === WebSocket.CONNECTING) reject(new SpeechProviderError(err.message, { cause: err }));
      });

      ws.on("close", (code, reason) => {
        this.handlers.onConnectionStateChange?.("disconnected");
        if (code !== 1000 && code !== 1001) {
          this.handlers.onError?.({
            code: "STT_WS_CLOSED",
            message: `STT socket closed (${code}) ${reason.toString()}`,
            recoverable: true,
            provider: this.name,
          });
        }
      });

      // Barge-in / cancellation.
      options.signal.addEventListener(
        "abort",
        () => {
          this.closeSocket(1000);
        },
        { once: true },
      );
    });
  }

  async sendAudio(chunk: AudioChunk): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const audioBase64 = Buffer.from(chunk.data).toString("base64");
    this.ws.send(JSON.stringify({ event: "audio_input", audio: audioBase64 }));
  }

  async updateLanguage(language: SttLanguage): Promise<void> {
    this.currentLanguage = language;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // Best-effort mid-call reconfiguration (Sarvam realtime supports config.update).
    this.ws.send(JSON.stringify({ event: "config.update", language_code: language }));
  }

  async stopSession(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event: "end" }));
    }
    this.closeSocket(1000);
  }

  async healthCheck(): Promise<boolean> {
    // No dedicated health endpoint; treat a configured key as "ready".
    return this.apiKey.length > 0;
  }

  private onMessage(raw: WebSocket.RawData): void {
    let evt: SarvamRealtimeEvent;
    try {
      evt = JSON.parse(raw.toString()) as SarvamRealtimeEvent;
    } catch {
      return; // ignore non-JSON frames
    }

    // Log all non-audio events for debugging (helps diagnose protocol issues).
    if (evt.event !== "audio_input") {
      console.debug(`[sarvam-stt] event: ${evt.event}`, JSON.stringify(evt).slice(0, 300));
    }

    switch (evt.event) {
      case "transcript.partial":
        if (evt.text) {
          this.handlers.onSpeechStart?.();
          this.handlers.onPartialTranscript?.({
            text: evt.text,
            language: this.normalizeLanguage(evt),
          });
        }
        break;
      case "transcript.final":
        if (evt.text) {
          this.handlers.onSpeechEnd?.();
          this.handlers.onFinalTranscript?.({
            text: evt.text,
            language: this.normalizeLanguage(evt),
            confidence: this.confidence(evt),
          });
        }
        break;
      case "vad.speech_start":
        this.handlers.onSpeechStart?.();
        break;
      case "vad.speech_end":
        this.handlers.onSpeechEnd?.();
        break;
      case "error":
        this.handlers.onError?.({
          code: String(evt.code ?? "STT_ERROR"),
          message: evt.message ?? "Sarvam STT error",
          recoverable: !evt.is_fatal,
          provider: this.name,
        });
        break;
      default:
        // Unknown events (e.g. session metadata) are ignored.
        break;
    }
  }

  private normalizeLanguage(evt: SarvamRealtimeEvent): LanguageCode {
    // The realtime endpoint may return the detected language under different
    // field names depending on the API version. Check all known variants.
    const raw =
      evt.language_code ??
      evt.language ??
      (typeof evt.detected_language === "string" ? evt.detected_language : undefined) ??
      (typeof evt.lang === "string" ? evt.lang : undefined);

    if (!raw) return this.fallbackLanguage();
    const base = raw.toLowerCase().split(/[-_]/)[0] ?? "hi";
    const allowed: LanguageCode[] = ["mr", "hi", "en", "gu", "ta", "te", "kn", "ml", "bn", "pa"];
    return (allowed as string[]).includes(base) ? (base as LanguageCode) : this.fallbackLanguage();
  }

  private fallbackLanguage(): LanguageCode {
    if (this.currentLanguage !== "auto") {
      const base = this.currentLanguage.split(/[-_]/)[0] ?? "hi";
      const allowed: LanguageCode[] = ["mr", "hi", "en", "gu", "ta", "te", "kn", "ml", "bn", "pa"];
      if ((allowed as string[]).includes(base)) return base as LanguageCode;
    }
    return "hi";
  }

  /** Sarvam realtime returns language_confidence; fall back to a high default
   *  so the orchestrator adopts the detected language. */
  private confidence(evt: SarvamRealtimeEvent): number {
    if (typeof evt.language_confidence === "number") return evt.language_confidence;
    if (typeof evt.language_probability === "number") return evt.language_probability;
    const lang = evt.language_code ?? evt.language;
    return lang ? 0.95 : 0.5;
  }

  private closeSocket(code: number): void {
    if (!this.ws) return;
    const ws = this.ws;
    this.ws = null;
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(code, "session end");
      }
      ws.removeAllListeners();
    } catch {
      /* ignore */
    }
  }
}
