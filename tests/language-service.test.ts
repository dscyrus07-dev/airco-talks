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
      const result = service.resolveTranslationTarget("pa", "pa", "mr", undefined, 0.95, 0.6);
      expect(result.target).toBe("mr");
      expect(result.speakerSide).toBe("my");
    });

    it("translates the other person's speech back for the device holder (fixed pair)", () => {
      const result = service.resolveTranslationTarget("mr", "pa", "mr", undefined, 0.95, 0.6);
      expect(result.target).toBe("pa");
      expect(result.speakerSide).toBe("their");
    });

    it("assumes the device holder spoke when detection is outside a fixed pair", () => {
      const result = service.resolveTranslationTarget("hi", "pa", "mr", undefined, 0.95, 0.6);
      expect(result.target).toBe("mr");
      expect(result.speakerSide).toBe("my");
    });

    it("handles an inverted fixed pair", () => {
      expect(service.resolveTranslationTarget("mr", "mr", "pa", undefined, 0.95, 0.6).target).toBe("pa");
      expect(service.resolveTranslationTarget("pa", "mr", "pa", undefined, 0.95, 0.6).target).toBe("mr");
    });

    it("auto mode: customer speech is translated into the holder's language", () => {
      const result = service.resolveTranslationTarget("mr", "hi", AUTO_LANGUAGE, undefined, 0.95, 0.6);
      expect(result.target).toBe("hi");
      expect(result.speakerSide).toBe("their");
      expect(result.newCustomerLanguage).toBe("mr");
    });

    it("auto mode: the holder's reply is translated into the customer's last heard language", () => {
      const result = service.resolveTranslationTarget("hi", "hi", AUTO_LANGUAGE, "mr", 0.95, 0.6);
      expect(result.target).toBe("mr");
      expect(result.speakerSide).toBe("my");
      expect(result.newCustomerLanguage).toBeUndefined();
    });

    it("auto mode: falls back to English when the holder speaks before the customer is heard", () => {
      const result = service.resolveTranslationTarget("hi", "hi", AUTO_LANGUAGE, undefined, 0.95, 0.6);
      expect(result.target).toBe("en");
      expect(result.speakerSide).toBe("my");
    });

    it("auto mode: does not remember the customer language on low confidence", () => {
      const result = service.resolveTranslationTarget("ta", "hi", AUTO_LANGUAGE, "mr", 0.4, 0.6);
      expect(result.target).toBe("hi");
      expect(result.speakerSide).toBe("their");
      expect(result.newCustomerLanguage).toBeUndefined();
    });

    it("auto mode: keeps direction stable across alternating turns", () => {
      // Customer speaks Tamil → holder hears Hindi, customer language remembered.
      const first = service.resolveTranslationTarget("ta", "hi", AUTO_LANGUAGE, undefined, 0.95, 0.6);
      expect(first.target).toBe("hi");
      expect(first.speakerSide).toBe("their");
      expect(first.newCustomerLanguage).toBe("ta");
      // Holder replies in Hindi → customer hears Tamil.
      const second = service.resolveTranslationTarget("hi", "hi", AUTO_LANGUAGE, "ta", 0.95, 0.6);
      expect(second.target).toBe("ta");
      expect(second.speakerSide).toBe("my");
    });
  });

  describe("resolveSpeakerSide", () => {
    it("routes fixed-pair detections to the matching side", () => {
      expect(service.resolveSpeakerSide("pa", "pa", "mr")).toBe("my");
      expect(service.resolveSpeakerSide("mr", "pa", "mr")).toBe("their");
    });

    it("assumes the holder spoke when detection is outside a fixed pair", () => {
      expect(service.resolveSpeakerSide("hi", "pa", "mr")).toBe("my");
    });

    it("auto mode: holder's language is the holder, anything else is the customer", () => {
      expect(service.resolveSpeakerSide("hi", "hi", AUTO_LANGUAGE)).toBe("my");
      expect(service.resolveSpeakerSide("ta", "hi", AUTO_LANGUAGE)).toBe("their");
    });
  });

  describe("isOutOfTurn", () => {
    it("open floor: nobody is out of turn", () => {
      expect(service.isOutOfTurn(null, "pa", "pa", "mr", undefined)).toBe(false);
      expect(service.isOutOfTurn(null, "mr", "pa", "mr", undefined)).toBe(false);
    });

    it("holder's turn: drops speech clearly in the customer's language", () => {
      expect(service.isOutOfTurn("my", "mr", "pa", "mr", undefined)).toBe(true);
    });

    it("holder's turn: accepts the holder's language and ambiguous detections", () => {
      expect(service.isOutOfTurn("my", "pa", "pa", "mr", undefined)).toBe(false);
      // Detection misfire outside the pair fails open (never swallows the holder).
      expect(service.isOutOfTurn("my", "hi", "pa", "mr", undefined)).toBe(false);
    });

    it("holder's turn (auto): drops only the customer's remembered language", () => {
      expect(service.isOutOfTurn("my", "ta", "hi", AUTO_LANGUAGE, "ta")).toBe(true);
      expect(service.isOutOfTurn("my", "hi", "hi", AUTO_LANGUAGE, "ta")).toBe(false);
      // Hinglish misfire is not the customer's language → accepted.
      expect(service.isOutOfTurn("my", "en", "hi", AUTO_LANGUAGE, "ta")).toBe(false);
    });

    it("customer's turn: drops speech clearly in the holder's language", () => {
      expect(service.isOutOfTurn("their", "pa", "pa", "mr", undefined)).toBe(true);
      expect(service.isOutOfTurn("their", "mr", "pa", "mr", undefined)).toBe(false);
    });

    it("customer's turn (auto): drops only the holder's language", () => {
      expect(service.isOutOfTurn("their", "hi", "hi", AUTO_LANGUAGE, "ta")).toBe(true);
      expect(service.isOutOfTurn("their", "ta", "hi", AUTO_LANGUAGE, "ta")).toBe(false);
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
