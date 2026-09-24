import { describe, it, expect } from "vitest";
import { LanguageService } from "../server/src/application/language-service.js";
import { AUTO_LANGUAGE } from "@airco-talks/shared";

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
 expect(service.toLocale("pa")).toBe("pa-IN");
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

  describe("resolveTranslationTarget", () => {
    it("translates the device holder's language into the other person's (fixed pair)", () => {
      expect(service.resolveTranslationTarget("pa", "pa", "mr", undefined, 0.95, 0.6).target).toBe("mr");
    });

    it("translates the other person's speech back for the device holder (fixed pair)", () => {
      expect(service.resolveTranslationTarget("mr", "pa", "mr", undefined, 0.95, 0.6).target).toBe("pa");
    });

    it("assumes the device holder spoke when detection is outside a fixed pair", () => {
      expect(service.resolveTranslationTarget("hi", "pa", "mr", undefined, 0.95, 0.6).target).toBe("mr");
    });

    it("handles an inverted fixed pair", () => {
      expect(service.resolveTranslationTarget("mr", "mr", "pa", undefined, 0.95, 0.6).target).toBe("pa");
      expect(service.resolveTranslationTarget("pa", "mr", "pa", undefined, 0.95, 0.6).target).toBe("mr");
    });

    it("auto mode: customer speech is translated into the holder's language", () => {
      const result = service.resolveTranslationTarget("mr", "hi", AUTO_LANGUAGE, undefined, 0.95, 0.6);
      expect(result.target).toBe("hi");
      expect(result.newCustomerLanguage).toBe("mr");
    });

    it("auto mode: the holder's reply is translated into the customer's last heard language", () => {
      const result = service.resolveTranslationTarget("hi", "hi", AUTO_LANGUAGE, "mr", 0.95, 0.6);
      expect(result.target).toBe("mr");
      expect(result.newCustomerLanguage).toBeUndefined();
    });

    it("auto mode: falls back to English when the holder speaks before the customer is heard", () => {
      const result = service.resolveTranslationTarget("hi", "hi", AUTO_LANGUAGE, undefined, 0.95, 0.6);
      expect(result.target).toBe("en");
    });

    it("auto mode: does not remember the customer language on low confidence", () => {
      const result = service.resolveTranslationTarget("ta", "hi", AUTO_LANGUAGE, "mr", 0.4, 0.6);
      expect(result.target).toBe("hi");
      expect(result.newCustomerLanguage).toBeUndefined();
    });

    it("auto mode: keeps direction stable across alternating turns", () => {
      // Customer speaks Tamil → holder hears Hindi, customer language remembered.
      const first = service.resolveTranslationTarget("ta", "hi", AUTO_LANGUAGE, undefined, 0.95, 0.6);
      expect(first.target).toBe("hi");
      expect(first.newCustomerLanguage).toBe("ta");
      // Holder replies in Hindi → customer hears Tamil.
      const second = service.resolveTranslationTarget("hi", "hi", AUTO_LANGUAGE, "ta", 0.95, 0.6);
      expect(second.target).toBe("ta");
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
