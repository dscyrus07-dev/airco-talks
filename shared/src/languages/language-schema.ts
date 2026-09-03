/**
 * Zod schemas for language values, used by the WebSocket protocol validation.
 */
import { z } from "zod";
import { LANGUAGE_CODES, AUTO_LANGUAGE, type LanguageCode } from "./language-codes.js";

export const LanguageCodeSchema = z.enum(
  LANGUAGE_CODES as unknown as [LanguageCode, ...LanguageCode[]],
);

export const LanguageSettingSchema = z.enum([
  AUTO_LANGUAGE,
  ...(LANGUAGE_CODES as unknown as [LanguageCode, ...LanguageCode[]]),
]);
