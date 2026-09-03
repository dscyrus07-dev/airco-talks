import type { LanguageCode } from "@dhvani/shared";
import type { ProviderErrorEvent, Unsubscribe } from "./speech-recognition-provider.js";

export interface TTSRequest {
  text: string;
  language: LanguageCode;
  /** Speaker voice override; empty = provider default for the language. */
  voice?: string;
  /** AbortSignal for barge-in / cancellation. */
  signal: AbortSignal;
}

export interface TTSStreamHandlers {
  onFirstAudio?(): void;
  /** base64-encoded PCM audio chunk (16-bit mono). */
  onChunk?(audioBase64: string, sampleRate: number): void;
  onComplete?(): void;
  onError?(e: ProviderErrorEvent): void;
}

/**
 * Contract for streaming text-to-speech. The provider must emit audio chunks
 * as soon as they are available so playback can start before full synthesis.
 */
export interface TTSProvider {
  readonly name: string;
  streamSynthesis(request: TTSRequest, handlers: TTSStreamHandlers): Promise<void>;
  /** Returns available voices for a language, if known. */
  getVoices?(language: LanguageCode): string[];
  healthCheck(): Promise<boolean>;
}
