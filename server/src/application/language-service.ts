import {
  type LanguageCode,
  type LanguageLocale,
  type LanguageSetting,
  AUTO_LANGUAGE,
  getLanguage,
  getLanguageByLocale,
  isLanguageCode,
} from "@dhvani/shared";

/**
 * Single place for language normalization, mapping, and the code-switching
 * policy. No other module decides when to switch the conversation language.
 */
export class LanguageService {
  /** Normalize any provider/string input to a canonical LanguageCode. */
  normalizeLanguageCode(input: unknown, fallback: LanguageCode = "hi"): LanguageCode {
    if (typeof input !== "string" || input.length === 0) return fallback;
    const lower = input.toLowerCase();
    if (isLanguageCode(lower)) return lower;
    // "hi-IN" / "hi_IN" / "hi-in" → "hi"
    const base = lower.split(/[-_]/)[0];
    if (base && isLanguageCode(base)) return base as LanguageCode;
    // English name lookup
    const byName = this.byName(lower);
    if (byName) return byName;
    return fallback;
  }

  toLocale(code: LanguageCode): LanguageLocale {
    return getLanguage(code).locale;
  }

  toCode(locale: string): LanguageCode {
    return getLanguageByLocale(locale)?.code ?? this.normalizeLanguageCode(locale);
  }

  getName(code: LanguageCode): string {
    return getLanguage(code).name;
  }

  getEndonym(code: LanguageCode): string {
    return getLanguage(code).endonym;
  }

  getDefaultVoice(code: LanguageCode): string {
    return getLanguage(code).defaultVoice;
  }

  /**
   * Resolve the effective STT locale for a session given the user setting and
   * the last known preferred language. In AUTO mode we start from the last
   * detected language (or the configured default) and refine later.
   */
  resolveSttLocale(setting: LanguageSetting, preferred: LanguageCode, defaultAuto: LanguageCode): LanguageLocale {
    const code = setting === AUTO_LANGUAGE ? (preferred ?? defaultAuto) : setting;
    return this.toLocale(code);
  }

  /**
   * Code-switching policy. Returns the new preferred language, or the current
   * one if we should NOT switch (low confidence or fixed user setting).
   *
   * A single borrowed English word in a Marathi sentence must not flip the
   * whole conversation to English — that is handled by the confidence gate
   * and by the LLM responding in the preferred language regardless.
   */
  shouldAdoptNewLanguage(
    detected: LanguageCode,
    confidence: number,
    current: LanguageCode,
    threshold: number,
    setting: LanguageSetting,
  ): { adopted: boolean; preferred: LanguageCode } {
    if (setting !== AUTO_LANGUAGE) {
      return { adopted: false, preferred: setting };
    }
    if (confidence >= threshold && detected !== current) {
      return { adopted: true, preferred: detected };
    }
    return { adopted: false, preferred: current };
  }

  /**
   * Best-effort language detection from transcript text via Unicode script.
   * Used only as a supplement when the STT provider did not report a language.
   * Marathi and Hindi share Devanagari, so for Devanagari we keep the current
   * preferred language rather than guessing (honest about the limitation).
   */
  detectFromText(text: string, current: LanguageCode): LanguageCode {
    if (!text) return current;
    for (const ch of text) {
      const code = ch.codePointAt(0);
      if (code === undefined) continue;
      if (code >= 0x0900 && code <= 0x097f) return current; // Devanagari — hi/mr ambiguous
      if (code >= 0x0a80 && code <= 0x0aff) return "gu"; // Gujarati
      if (code >= 0x0b80 && code <= 0x0bff) return "ta"; // Tamil
      if (code >= 0x0c00 && code <= 0x0c7f) return "te"; // Telugu
      if (code >= 0x0c80 && code <= 0x0cff) return "kn"; // Kannada
      if (code >= 0x0d00 && code <= 0x0d7f) return "ml"; // Malayalam
      if (code >= 0x0980 && code <= 0x09ff) return "bn"; // Bengali
      if (code >= 0x0a00 && code <= 0x0a7f) return "pa"; // Gurmukhi (Punjabi)
      if (code >= 0x0041 && code <= 0x024f) return "en"; // Latin
    }
    return current;
  }

  private byName(name: string): LanguageCode | undefined {
    const map: Record<string, LanguageCode> = {
      hindi: "hi",
      marathi: "mr",
      english: "en",
      gujarati: "gu",
      tamil: "ta",
      telugu: "te",
      kannada: "kn",
      malayalam: "ml",
      bengali: "bn",
      punjabi: "pa",
    };
    return map[name];
  }
}
