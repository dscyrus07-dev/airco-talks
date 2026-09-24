import { describe, it, expect } from "vitest";
import { buildTranslationPrompt } from "../server/src/application/prompt-builder.js";

describe("buildTranslationPrompt", () => {
  it("names both languages and the direction in the system prompt", () => {
    const result = buildTranslationPrompt("ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?", "pa", "mr");
    expect(result.system).toContain("Punjabi");
    expect(result.system).toContain("ਪੰਜਾਬੀ");
    expect(result.system).toContain("Marathi");
    expect(result.system).toContain("मराठी");
  });

  it("sends exactly one system message and one user message", () => {
    const result = buildTranslationPrompt("ਹੈਲੋ", "pa", "mr");
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]?.role).toBe("system");
    expect(result.messages[1]?.role).toBe("user");
    expect(result.messages[1]?.content).toBe("ਹੈਲੋ");
  });

  it("forbids answering instead of translating", () => {
    const result = buildTranslationPrompt("test", "mr", "pa");
    expect(result.system.toLowerCase()).toContain("only");
    expect(result.system.toLowerCase()).toContain("translation");
  });

  it("names the source and target languages explicitly", () => {
    const result = buildTranslationPrompt("test", "pa", "mr");
    expect(result.system).toContain("Punjabi");
    expect(result.system).toContain("ਪੰਜਾਬੀ");
    expect(result.system).toContain("Marathi");
    expect(result.system).toContain("मराठी");
  });

  it("keeps output speech-ready for TTS", () => {
    const result = buildTranslationPrompt("test", "hi", "en");
    expect(result.system.toLowerCase()).toContain("text-to-speech");
  });

  it("handles code-switching guidance", () => {
    const result = buildTranslationPrompt("test", "mr", "pa");
    expect(result.system.toLowerCase()).toContain("code-switch");
  });

  it("works with any supported language pair", () => {
    const result = buildTranslationPrompt("hello", "en", "ta");
    expect(result.system).toContain("English");
    expect(result.system).toContain("Tamil");
  });
});
