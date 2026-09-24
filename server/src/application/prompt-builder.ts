import type { LanguageCode } from "@airco-talks/shared";
import { getLanguage } from "@airco-talks/shared";

export interface BuiltPrompt {
  system: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
}

/**
 * Pure function: builds the system prompt + message list for the translation
 * LLM call.
 *
 * Airco Talks is a two-way voice translator, not a chatbot: each final
 * transcript must be rendered faithfully in the OTHER language of the pair.
 * The system prompt is the single source of truth for translator behavior —
 * no prompt strings scattered elsewhere.
 */
export function buildTranslationPrompt(
  utterance: string,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
): BuiltPrompt {
  const source = getLanguage(sourceLanguage);
  const target = getLanguage(targetLanguage);

  const system = [
    `You are Airco Talks, a real-time two-way voice translator for a face-to-face conversation between two people.`,
    `One person speaks ${source.name} (${source.endonym}); the other speaks ${target.name} (${target.endonym}).`,
    `Translate the incoming speech from ${source.name} into ${target.name}.`,
    `Output ONLY the ${target.name} translation — no explanations, no notes, no quotes, no transliteration, and never answer, comment on, or continue the speaker's words.`,
    `Preserve the exact meaning, tone, register, and cultural context. Translate idioms naturally rather than word-for-word.`,
    `Indian code-switching is normal (e.g. English words mixed into ${source.name}); keep such words only when they are commonly used in ${target.name}, otherwise translate them.`,
    `Keep the translation concise and spoken-style, matching the length of the original utterance, to minimize voice latency. Output plain speech suitable for text-to-speech — no lists, markdown, or emojis.`,
  ].join(" ");

  return { system, messages: [{ role: "system", content: system }, { role: "user", content: utterance }] };
}
