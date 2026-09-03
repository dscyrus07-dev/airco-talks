import type { LanguageCode, LanguageSetting } from "@dhvani/shared";
import { AUTO_LANGUAGE } from "@dhvani/shared";
import { MAX_CONTEXT_MESSAGES } from "@dhvani/shared";
import type { Message, MessageRole } from "./message.js";
import { createMessage } from "./message.js";

/**
 * Owns the message array for a session. Other components must not mutate the
 * array directly — they go through {@link ConversationManager}.
 */
export class Conversation {
  readonly id: string;
  private readonly messages: Message[] = [];
  /** The language the assistant currently responds in (sticky across code-switches). */
  private preferredLanguage: LanguageCode;
  /** Raw user setting ("auto" or a fixed code). */
  private languageSetting: LanguageSetting;
  private lastDetectedLanguage: LanguageCode;
  private lastConfidence = 0;

  constructor(id: string, setting: LanguageSetting, initialLanguage: LanguageCode) {
    this.id = id;
    this.languageSetting = setting;
    this.preferredLanguage = initialLanguage;
    this.lastDetectedLanguage = initialLanguage;
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

  getPreferredLanguage(): LanguageCode {
    return this.preferredLanguage;
  }

  getLanguageSetting(): LanguageSetting {
    return this.languageSetting;
  }

  getLastDetectedLanguage(): LanguageCode {
    return this.lastDetectedLanguage;
  }

  getLastConfidence(): number {
    return this.lastConfidence;
  }

  setLanguageSetting(setting: LanguageSetting): void {
    this.languageSetting = setting;
  }

  /**
   * Adopt a newly detected language as preferred, but only if confidence is
   * high enough OR the user has fixed the language explicitly. Low-confidence
   * detections keep the previous preferred language (avoids flapping on a
   * single borrowed English word).
   */
  adoptDetectedLanguage(language: LanguageCode, confidence: number, threshold: number): boolean {
    this.lastDetectedLanguage = language;
    this.lastConfidence = confidence;
    if (this.languageSetting !== AUTO_LANGUAGE) {
      // User fixed a language; respect it and don't auto-switch.
      this.preferredLanguage = this.languageSetting;
      return false;
    }
    if (confidence >= threshold) {
      this.preferredLanguage = language;
      return true;
    }
    return false;
  }

  /** Force-set the preferred language (used after external policy check). */
  setPreferredLanguage(language: LanguageCode): void {
    this.preferredLanguage = language;
  }

  reset(): void {
    this.messages.length = 0;
  }
}
