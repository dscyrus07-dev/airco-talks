import type { LanguageCode, LanguageLocale } from "@airco-talks/shared";

export type Unsubscribe = () => void;

/** Raw PCM audio chunk (16-bit signed little-endian mono). */
export interface AudioChunk {
  readonly data: Uint8Array;
  readonly sampleRate: number;
}

export interface ProviderErrorEvent {
  code: string;
  message: string;
  recoverable: boolean;
  provider: string;
  cause?: unknown;
}

/** Streaming callbacks the STT provider fires during a session. */
export interface SpeechRecognitionHandlers {
  onPartialTranscript?(e: { text: string; language: LanguageCode }): void;
  onFinalTranscript?(e: { text: string; language: LanguageCode; confidence: number }): void;
  onSpeechStart?(): void;
  /** User stopped speaking (end-of-turn detected by VAD). */
  onSpeechEnd?(): void;
  onError?(e: ProviderErrorEvent): void;
  onConnectionStateChange?(state: "connected" | "disconnected" | "reconnecting"): void;
}

/** STT language: a BCP-47 locale, or "auto" for provider-side detection. */
export type SttLanguage = LanguageLocale | "auto";

export interface StartSpeechSessionOptions {
  language: SttLanguage;
  sampleRate: number;
  handlers: SpeechRecognitionHandlers;
  /** AbortSignal for barge-in / session cancellation. */
  signal: AbortSignal;
}

/**
 * Contract for streaming speech-to-text. AssemblyAI / Azure / another provider
 * can implement this without business logic changing.
 */
export interface SpeechRecognitionProvider {
  readonly name: string;
  startSession(options: StartSpeechSessionOptions): Promise<void>;
  sendAudio(chunk: AudioChunk): Promise<void>;
  /** Live language switch (mid-call reconfiguration) if the provider supports it. */
  updateLanguage(language: SttLanguage): Promise<void>;
  stopSession(): Promise<void>;
  healthCheck(): Promise<boolean>;
}
