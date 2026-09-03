import { describe, it, expect } from "vitest";
import { LanguageService } from "../server/src/application/language-service.js";
import { AUTO_LANGUAGE } from "@dhvani/shared";

describe("LanguageService", () => {
  const service = new LanguageService();

  describe("normalizeLanguageCode", () => {
    it("returns the code for a valid LanguageCode string", () => {
      expect(service.normalizeLanguageCode("mr")).toBe("mr");
      expect(service.normalizeLanguageCode("hi")).toBe("hi");
    });

    it("extracts the base from a BCP-47 locale", () => {
      expect(service.normalizeLanguageCode("mr-IN")).toBe("mr");
      expect(service.normalizeLanguageCode("hi-IN")).toBe("hi");
    });

    it("handles case-insensitively", () => {
      expect(service.normalizeLanguageCode("MR")).toBe("mr");
      expect(service.normalizeLanguageCode("Hi-In")).toBe("hi");
    });

    it("resolves English names", () => {
      expect(service.normalizeLanguageCode("marathi")).toBe("mr");
      expect(service.normalizeLanguageCode("hindi")).toBe("hi");
    });

    it("falls back for unknown input", () => {
      expect(service.normalizeLanguageCode("xx")).toBe("hi");
      expect(service.normalizeLanguageCode("")).toBe("hi");
      expect(service.normalizeLanguageCode(123)).toBe("hi");
    });

    it("uses a custom fallback", () => {
      expect(service.normalizeLanguageCode("xx", "mr")).toBe("mr");
    });
  });

  describe("toLocale", () => {
    it("converts a LanguageCode to its BCP-47 locale", () => {
      expect(service.toLocale("mr")).toBe("mr-IN");
      expect(service.toLocale("hi")).toBe("hi-IN");
      expect(service.toLocale("en")).toBe("en-IN");
    });
  });

  describe("toCode", () => {
    it("converts a BCP-47 locale to a LanguageCode", () => {
      expect(service.toCode("mr-IN")).toBe("mr");
      expect(service.toCode("hi-IN")).toBe("hi");
    });

    it("falls back for unknown locales", () => {
      expect(service.toCode("fr-FR")).toBe("hi");
    });
  });

  describe("resolveSttLocale", () => {
    it("uses preferred language in AUTO mode", () => {
      expect(service.resolveSttLocale(AUTO_LANGUAGE, "mr", "hi")).toBe("mr-IN");
    });

    it("uses default when preferred is not set", () => {
      expect(service.resolveSttLocale(AUTO_LANGUAGE, "hi", "mr")).toBe("hi-IN");
    });

    it("uses the fixed setting when not AUTO", () => {
      expect(service.resolveSttLocale("mr", "hi", "hi")).toBe("mr-IN");
    });
  });

  describe("shouldAdoptNewLanguage", () => {
    it("adopts a new language when confidence is above threshold", () => {
      const result = service.shouldAdoptNewLanguage("mr", 0.95, "hi", 0.6, AUTO_LANGUAGE);
      expect(result.adopted).toBe(true);
      expect(result.preferred).toBe("mr");
    });

    it("does not adopt when confidence is below threshold", () => {
      const result = service.shouldAdoptNewLanguage("mr", 0.4, "hi", 0.6, AUTO_LANGUAGE);
      expect(result.adopted).toBe(false);
      expect(result.preferred).toBe("hi");
    });

    it("does not adopt when the setting is a fixed language", () => {
      const result = service.shouldAdoptNewLanguage("mr", 0.99, "hi", 0.6, "hi");
      expect(result.adopted).toBe(false);
      expect(result.preferred).toBe("hi");
    });

    it("does not adopt the same language again", () => {
      const result = service.shouldAdoptNewLanguage("mr", 0.99, "mr", 0.6, AUTO_LANGUAGE);
      expect(result.adopted).toBe(false);
      expect(result.preferred).toBe("mr");
    });
  });

  describe("detectFromText", () => {
    it("detects Gujarati from Gujarati script", () => {
      expect(service.detectFromText("નમસ્તે", "hi")).toBe("gu");
    });

    it("detects Tamil from Tamil script", () => {
      expect(service.detectFromText("வணக்கம்", "hi")).toBe("ta");
    });

    it("detects English from Latin script", () => {
      expect(service.detectFromText("Hello", "hi")).toBe("en");
    });

    it("keeps current language for Devanagari (hi/mr ambiguous)", () => {
      expect(service.detectFromText("नमस्कार", "mr")).toBe("mr");
      expect(service.detectFromText("नमस्कार", "hi")).toBe("hi");
    });

    it("returns current for empty text", () => {
      expect(service.detectFromText("", "hi")).toBe("hi");
    });
  });
});
