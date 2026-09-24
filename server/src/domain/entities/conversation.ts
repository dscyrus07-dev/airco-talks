import type { LanguageCode, LanguageSetting } from "@airco-talks/shared";
import { MAX_CONTEXT_MESSAGES } from "@airco-talks/shared";
import type { Message, MessageRole } from "./message.js";
import { createMessage } from "./message.js";

/**
 * Owns the message array for a session plus the language pair being
 * translated. Other components must not mutate the array directly — they go
 * through {@link ConversationManager}.
 */
export class Conversation {
  readonly id: string;
  private readonly messages: Message[] = [];
  /** Language of the person holding the device. */
  private myLanguage: LanguageCode;
  /** Language of the other person — a fixed code or "auto" (customer mode). */
  private theirLanguage: LanguageSetting;
  /** The customer's last heard language (used when theirLanguage is "auto"). */
  private lastCustomerLanguage?: LanguageCode;
  private lastDetectedLanguage: LanguageCode;
  private lastConfidence = 0;

  constructor(id: string, myLanguage: LanguageCode, theirLanguage: LanguageSetting) {
    this.id = id;
    this.myLanguage = myLanguage;
    this.theirLanguage = theirLanguage;
    this.lastDetectedLanguage = myLanguage;
  }

  add(role: MessageRole, content: string, language: LanguageCode, metadata?: Message["metadata"]): Message {
    const message = createMessage(role, content, language, metadata);
    this.messages.push(message);
    return message;
  }

  addUserMessage(content: string, language: LanguageCode, metadata?: Message["metadata"]): Message {
    return this.add("user", content, language, metadata);
  }

  addAssistantMessage(content: string, language: LanguageCode, metadata?: Message["metadata"]): Message {
    return this.add("assistant", content, language, metadata);
  }

  /** Recent context for the LLM, capped to control token usage. */
  getContext(max = MAX_CONTEXT_MESSAGES): Message[] {
    return this.messages.slice(-max);
  }

  getAll(): readonly Message[] {
    return this.messages;
  }

  getMyLanguage(): LanguageCode {
    return this.myLanguage;
  }

  getTheirLanguage(): LanguageSetting {
    return this.theirLanguage;
  }

  getLastCustomerLanguage(): LanguageCode | undefined {
    return this.lastCustomerLanguage;
  }

  getLastDetectedLanguage(): LanguageCode {
    return this.lastDetectedLanguage;
  }

  getLastConfidence(): number {
    return this.lastConfidence;
  }

  /** Swap the direction of translation (who speaks which language). */
  setLanguagePair(myLanguage: LanguageCode, theirLanguage: LanguageSetting): void {
    this.myLanguage = myLanguage;
    this.theirLanguage = theirLanguage;
    this.lastCustomerLanguage = undefined;
  }

  /** Remember the customer's language (customer/"auto" mode). */
  setLastCustomerLanguage(language: LanguageCode): void {
    this.lastCustomerLanguage = language;
  }

  recordDetection(language: LanguageCode, confidence: number): void {
    this.lastDetectedLanguage = language;
    this.lastConfidence = confidence;
  }

  reset(): void {
    this.messages.length = 0;
  }
}