import type { LanguageCode } from "@dhvani/shared";
import type { ProviderErrorEvent } from "./speech-recognition-provider.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  /** Pre-built message list (system prompt + history + current user turn). */
  messages: ChatMessage[];
  /** Language the assistant should respond in (for reference / logging). */
  preferredLanguage: LanguageCode;
  /** AbortSignal for barge-in / cancellation. */
  signal: AbortSignal;
}

export interface LLMStreamHandlers {
  onFirstToken?(): void;
  onChunk?(text: string): void;
  onComplete?(fullText: string): void;
  onError?(e: ProviderErrorEvent): void;
}

/**
 * Contract for the conversational LLM. Streaming is mandatory for low
 * time-to-first-audio — the orchestrator forwards chunks to TTS as they arrive.
 */
export interface LLMProvider {
  readonly name: string;
  streamResponse(request: LLMRequest, handlers: LLMStreamHandlers): Promise<void>;
  healthCheck(): Promise<boolean>;
}
