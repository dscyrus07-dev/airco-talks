import { describe, it, expect, beforeEach } from "vitest";
import { ConversationManager } from "../server/src/application/conversation-manager.js";

describe("ConversationManager", () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
  });

  it("creates a conversation with a session id and language pair", () => {
    const conv = manager.create("s1", "pa", "mr");
    expect(conv.id).toBe("s1");
    expect(conv.getMyLanguage()).toBe("pa");
    expect(conv.getTheirLanguage()).toBe("mr");
  });

  it("get returns the conversation by id", () => {
    manager.create("s1", "pa", "mr");
    expect(manager.get("s1")?.id).toBe("s1");
    expect(manager.get("nonexistent")).toBeUndefined();
  });

  it("getOrCreate returns existing without overwriting", () => {
    const c1 = manager.create("s1", "pa", "mr");
    const c2 = manager.getOrCreate("s1", "hi", "en");
    expect(c2).toBe(c1);
    expect(c2.getMyLanguage()).toBe("pa");
  });

  it("addUserMessage appends to the conversation", () => {
    const conv = manager.create("s1", "pa", "mr");
    conv.addUserMessage("hello", "en");
    expect(conv.getAll().length).toBe(1);
    expect(conv.getAll()[0]?.content).toBe("hello");
  });

  it("addAssistantMessage appends to the conversation", () => {
    const conv = manager.create("s1", "pa", "mr");
    conv.addAssistantMessage("ਨਮਸਤੇ", "pa");
    expect(conv.getAll().length).toBe(1);
    expect(conv.getAll()[0]?.role).toBe("assistant");
  });

  it("getContext returns the last N messages", () => {
    const conv = manager.create("s1", "pa", "mr");
    for (let i = 0; i < 20; i++) {
      conv.addUserMessage(`msg ${i}`, "en");
    }
    expect(conv.getAll().length).toBe(20);
    expect(conv.getContext(5).length).toBe(5);
    expect(conv.getContext(5)[0]?.content).toBe("msg 15");
  });

  it("setLanguagePair updates the direction", () => {
    const conv = manager.create("s1", "pa", "mr");
    conv.setLanguagePair("mr", "pa");
    expect(conv.getMyLanguage()).toBe("mr");
    expect(conv.getTheirLanguage()).toBe("pa");
  });

  it("recordDetection stores the last detected language", () => {
    const conv = manager.create("s1", "pa", "mr");
    conv.recordDetection("mr", 0.9);
    expect(conv.getLastDetectedLanguage()).toBe("mr");
    expect(conv.getLastConfidence()).toBe(0.9);
  });

  it("remove deletes the conversation", () => {
    manager.create("s1", "pa", "mr");
    manager.remove("s1");
    expect(manager.get("s1")).toBeUndefined();
  });

  it("clear removes all conversations", () => {
    manager.create("s1", "pa", "mr");
    manager.create("s2", "hi", "en");
    manager.clear();
    expect(manager.get("s1")).toBeUndefined();
    expect(manager.get("s2")).toBeUndefined();
  });

  it("reset clears messages but keeps the language pair", () => {
    const conv = manager.create("s1", "pa", "mr");
    conv.addUserMessage("hello", "en");
    conv.addAssistantMessage("hi there", "en");
    conv.reset();
    expect(conv.getAll().length).toBe(0);
    expect(conv.getMyLanguage()).toBe("pa");
    expect(conv.getTheirLanguage()).toBe("mr");
  });
});
