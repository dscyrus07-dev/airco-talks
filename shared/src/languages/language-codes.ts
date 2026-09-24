/**
 * Canonical language definitions for Airco Talks.
 *
 * Every other module references {@link LanguageCode} and {@link LANGUAGES}
 * instead of raw strings, so language-specific logic stays in one place and
 * adding a language is a single edit here.
 */

/** BCP-47-ish base code for a supported language (the script/locale part is separate). */
export type LanguageCode =
  | "mr" // Marathi
  | "hi" // Hindi
  | "en" // English
  | "gu" // Gujarati
  | "ta" // Tamil
  | "te" // Telugu
  | "kn" // Kannada
  | "ml" // Malayalam
  | "bn" // Bengali
  | "pa"; // Punjabi

/** Full BCP-47 locale used by Sarvam STT/TTS (India region). */
export type LanguageLocale = `${LanguageCode}-IN`;

export interface LanguageDefinition {
  code: LanguageCode;
  locale: LanguageLocale;
  /** English name for UI labels. */
  name: string;
  /** Endonym — the language's own name, for native UI labels. */
  endonym: string;
  /** Default Sarvam Bulbul TTS speaker for this language (may be overridden in settings). */
  defaultVoice: string;
}

/**
 * Ordered list of supported languages available for a translation pair.
 */
export const LANGUAGES: readonly LanguageDefinition[] = [
  { code: "hi", locale: "hi-IN", name: "Hindi", endonym: "हिन्दी", defaultVoice: "rahul" },
  { code: "mr", locale: "mr-IN", name: "Marathi", endonym: "मराठी", defaultVoice: "priya" },
  { code: "en", locale: "en-IN", name: "English", endonym: "English", defaultVoice: "aditya" },
  { code: "gu", locale: "gu-IN", name: "Gujarati", endonym: "ગુજરાતી", defaultVoice: "simran" },
  { code: "ta", locale: "ta-IN", name: "Tamil", endonym: "தமிழ்", defaultVoice: "kavya" },
  { code: "te", locale: "te-IN", name: "Telugu", endonym: "తెలుగు", defaultVoice: "dev" },
  { code: "kn", locale: "kn-IN", name: "Kannada", endonym: "ಕನ್ನಡ", defaultVoice: "neha" },
  { code: "ml", locale: "ml-IN", name: "Malayalam", endonym: "മലയാളം", defaultVoice: "pooja" },
  { code: "bn", locale: "bn-IN", name: "Bengali", endonym: "বাংলা", defaultVoice: "ritu" },
  { code: "pa", locale: "pa-IN", name: "Punjabi", endonym: "ਪੰਜਾਬੀ", defaultVoice: "rohan" },
] as const;

export const LANGUAGE_CODES: readonly LanguageCode[] = LANGUAGES.map((l) => l.code);

const LANGUAGE_BY_CODE: ReadonlyMap<LanguageCode, LanguageDefinition> = new Map(
  LANGUAGES.map((l) => [l.code, l]),
);

const LANGUAGE_BY_LOCALE: ReadonlyMap<string, LanguageDefinition> = new Map(
  LANGUAGES.map((l) => [l.locale, l]),
);

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === "string" && LANGUAGE_BY_CODE.has(value as LanguageCode);
}

export function getLanguage(code: LanguageCode): LanguageDefinition {
  const def = LANGUAGE_BY_CODE.get(code);
  if (!def) throw new Error(`Unknown language code: ${code}`);
  return def;
}

export function getLanguageByLocale(locale: string): LanguageDefinition | undefined {
  return LANGUAGE_BY_LOCALE.get(locale);
}

/**
 * "AUTO" sentinel for the customer's language: the system detects whatever
 * language the other person speaks and remembers it for replies.
 * Not a real LanguageCode.
 */
export const AUTO_LANGUAGE = "auto" as const;
export type LanguageSetting = typeof AUTO_LANGUAGE | LanguageCode;

export function isLanguageSetting(value: unknown): value is LanguageSetting {
  return value === AUTO_LANGUAGE || isLanguageCode(value);
}
