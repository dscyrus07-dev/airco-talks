import {
  type LanguageCode,
  type LanguageLocale,
  type LanguageSetting,
  AUTO_LANGUAGE,
  getLanguage,
  getLanguageByLocale,
  isLanguageCode,
} from "@airco-talks/shared";

/** Fallback target when the customer's language is "auto" but not yet heard. */
export const AUTO_CUSTOMER_FALLBACK: LanguageCode = "en";

/**
 * Single place for language normalization, mapping, and the translation
 * direction policy. No other module decides which language a turn is
 * translated into.
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
   * Translation direction policy.
   *
   * myLanguage is always the device holder's fixed language. theirSetting is
   * either the other person's fixed language or "auto":
   *
   * FIXED theirLanguage (original two-language mode):
   *  - detected == theirLanguage → the other person spoke → target myLanguage
   *  - otherwise (detected == myLanguage or outside the pair) → assume the
   *    device holder spoke → target theirLanguage
   *
   * AUTO theirLanguage (customer mode):
   *  - detected == myLanguage → the holder spoke → target the customer's
   *    last heard language (fallback "en" if nothing heard yet)
   *  - detected != myLanguage → the customer spoke → target myLanguage, and
   *    remember the detected language for future replies (only when the
   *    detection confidence clears the threshold, to avoid flapping).
   */
  resolveTranslationTarget(
    detected: LanguageCode,
    myLanguage: LanguageCode,
    theirSetting: LanguageSetting,
    lastCustomerLanguage: LanguageCode | undefined,
    confidence: number,
    threshold: number,
  ): { target: LanguageCode; newCustomerLanguage?: LanguageCode } {
    if (theirSetting !== AUTO_LANGUAGE) {
      return { target: detected === theirSetting ? myLanguage : theirSetting };
    }
    if (detected === myLanguage) {
      // The holder replied — speak to the customer in their last heard language.
      return { target: lastCustomerLanguage ?? AUTO_CUSTOMER_FALLBACK };
    }
    // Someone other than the holder spoke; translate for the holder and
    // remember the customer's language (confidence-gated to avoid flapping).
    return {
      target: myLanguage,
      newCustomerLanguage: confidence >= threshold ? detected : undefined,
    };
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
