import { describe, it, expect } from "vitest";
import { buildPrompt } from "../server/src/application/prompt-builder.js";
import { AUTO_LANGUAGE } from "@dhvani/shared";
import type { Message } from "../server/src/domain/entities/message.js";

describe("PromptBuilder", () => {
  const history: Message[] = [
    { id: "1", role: "user", content: "हॅलो", language: "mr", timestamp: Date.now() },
    { id: "2", role: "assistant", content: "नमस्कार!", language: "mr", timestamp: Date.now() },
  ];

  it("builds a system prompt with the language instruction", () => {
    const result = buildPrompt("काय चालू आहे?", "mr", "mr", history);
    expect(result.system).toContain("Marathi");
    expect(result.system).toContain("मराठी");
    expect(result.messages.length).toBe(history.length + 2); // system + history + new user
    expect(result.messages[0]?.role).toBe("system");
  });

  it("includes the new user message at the end", () => {
    const result = buildPrompt("काय चालू आहे?", "mr", "mr", history);
    const last = result.messages[result.messages.length - 1];
    expect(last?.role).toBe("user");
    expect(last?.content).toBe("काय चालू आहे?");
  });

  it("includes history messages in order", () => {
    const result = buildPrompt("test", "mr", "mr", history);
    // system + user(hello) + assistant(namaskar) + user(test)
    expect(result.messages[1]?.content).toBe("हॅलो");
    expect(result.messages[2]?.content).toBe("नमस्कार!");
  });

  it("skips system messages in history (only user/assistant)", () => {
    const withSystem: Message[] = [
      { id: "0", role: "system" as never, content: "ignored", language: "mr", timestamp: Date.now() },
      ...history,
    ];
    const result = buildPrompt("test", "mr", "mr", withSystem);
    // system prompt + 2 history + 1 new = 4
    expect(result.messages.length).toBe(4);
  });

  it("instructs the LLM to respond in the preferred language", () => {
    const result = buildPrompt("test", "hi", "hi", []);
    expect(result.system.toLowerCase()).toContain("hindi");
    expect(result.system).toContain("हिन्दी");
  });

  it("instructs the LLM to keep responses concise for voice", () => {
    const result = buildPrompt("test", "mr", "mr", []);
    expect(result.system.toLowerCase()).toContain("concise");
  });

  it("instructs the LLM not to translate to English", () => {
    const result = buildPrompt("test", "mr", "mr", []);
    expect(result.system.toLowerCase()).toContain("translate");
    expect(result.system.toLowerCase()).toContain("english");
  });

  it("handles code-switching guidance", () => {
    const result = buildPrompt("test", "mr", "mr", []);
    expect(result.system.toLowerCase()).toContain("code-switch");
  });

  it("works with empty history", () => {
    const result = buildPrompt("hello", "en", "en", []);
    expect(result.messages.length).toBe(2); // system + user
    expect(result.messages[0]?.role).toBe("system");
    expect(result.messages[1]?.role).toBe("user");
  });
});
