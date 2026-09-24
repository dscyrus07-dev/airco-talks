import type { LanguageCode, LanguageSetting } from "@airco-talks/shared";
import { Conversation } from "../domain/entities/conversation.js";

/**
 * Registry of active conversations keyed by session ID. Keeps Conversation
 * creation/lookup in one place so the orchestrator and WebSocket layer don't
 * each manage their own maps. Callers pass already-canonical language codes
 * (normalization is {@link LanguageService}'s job).
 */
export class ConversationManager {
  private readonly conversations = new Map<string, Conversation>();

  create(sessionId: string, myLanguage: LanguageCode, theirLanguage: LanguageSetting): Conversation {
    const existing = this.conversations.get(sessionId);
    if (existing) return existing;
    const conv = new Conversation(sessionId, myLanguage, theirLanguage);
    this.conversations.set(sessionId, conv);
    return conv;
  }

  get(sessionId: string): Conversation | undefined {
    return this.conversations.get(sessionId);
  }

  getOrCreate(sessionId: string, myLanguage: LanguageCode, theirLanguage: LanguageSetting): Conversation {
    return this.conversations.get(sessionId) ?? this.create(sessionId, myLanguage, theirLanguage);
  }

  remove(sessionId: string): void {
    this.conversations.delete(sessionId);
  }

  clear(): void {
    this.conversations.clear();
  }
}
