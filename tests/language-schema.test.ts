import { describe, it, expect } from "vitest";
import {
  AUTO_LANGUAGE,
  LANGUAGES,
  getLanguage,
  getLanguageByLocale,
  isLanguageCode,
} from "@dhvani/shared";

describe("language schema", () => {
  describe("LANGUAGES", () => {
    it("includes all 10 target languages", () => {
      const codes = LANGUAGES.map((l) => l.code);
      expect(codes).toContain("mr");
      expect(codes).toContain("hi");
      expect(codes).toContain("en");
      expect(codes).toContain("gu");
      expect(codes).toContain("ta");
      expect(codes).toContain("te");
      expect(codes).toContain("kn");
      expect(codes).toContain("ml");
      expect(codes).toContain("bn");
      expect(codes).toContain("pa");
      expect(LANGUAGES.length).toBe(10);
    });

    it("every language has a locale, endonym, and default voice", () => {
      for (const lang of LANGUAGES) {
        expect(lang.locale).toMatch(/^[a-z]{2}-IN$/);
        expect(lang.endonym.length).toBeGreaterThan(0);
        expect(lang.defaultVoice.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getLanguage", () => {
    it("returns the language for a valid code", () => {
      expect(getLanguage("mr").code).toBe("mr");
      expect(getLanguage("mr").endonym).toBe("मराठी");
    });

    it("throws for an invalid code", () => {
      expect(() => getLanguage("xx" as never)).toThrow();
    });
  });

  describe("getLanguageByLocale", () => {
    it("resolves mr-IN → Marathi", () => {
      expect(getLanguageByLocale("mr-IN")?.code).toBe("mr");
    });

    it("resolves hi-IN → Hindi", () => {
      expect(getLanguageByLocale("hi-IN")?.code).toBe("hi");
    });

    it("returns undefined for an unknown locale", () => {
      expect(getLanguageByLocale("fr-FR")).toBeUndefined();
    });
  });

  describe("isLanguageCode", () => {
    it("returns true for valid codes", () => {
      expect(isLanguageCode("mr")).toBe(true);
      expect(isLanguageCode("hi")).toBe(true);
    });

    it("returns false for invalid codes", () => {
      expect(isLanguageCode("xx")).toBe(false);
      expect(isLanguageCode("")).toBe(false);
    });
  });

  describe("AUTO_LANGUAGE", () => {
    it("is the string 'auto'", () => {
      expect(AUTO_LANGUAGE).toBe("auto");
    });
  });
});
