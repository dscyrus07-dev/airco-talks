import type { LanguageCode } from "@airco-talks/shared";

export type MessageRole = "user" | "assistant" | "system";

export interface MessageMetadata {
  /** STT confidence for user messages. */
  confidence?: number;
  /** Latency observability (ms). */
  llmFirstTokenMs?: number;
  ttsFirstAudioMs?: number;
  speechEndToFirstAudioMs?: number;
  [key: string]: unknown;
}

/**
 * Canonical message representation used everywhere — never ad-hoc
 * `{ text, who }` objects.
 */
export interface Message {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly language: LanguageCode;
  readonly timestamp: number;
  readonly metadata?: MessageMetadata;
}

export function createMessage(
  role: MessageRole,
  content: string,
  language: LanguageCode,
  metadata?: MessageMetadata,
): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    language,
    timestamp: Date.now(),
    metadata,
  };
}
