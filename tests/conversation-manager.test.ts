import { describe, it, expect, beforeEach } from "vitest";
import { ConversationManager } from "../server/src/application/conversation-manager.js";
import { AUTO_LANGUAGE } from "@dhvani/shared";

describe("ConversationManager", () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
  });

  it("creates a conversation with a session id and language setting", () => {
    const conv = manager.create("s1", AUTO_LANGUAGE, "hi");
    expect(conv.id).toBe("s1");
    expect(conv.getLanguageSetting()).toBe(AUTO_LANGUAGE);
    expect(conv.getPreferredLanguage()).toBe("hi");
  });

  it("get returns the conversation by id", () => {
    manager.create("s1", AUTO_LANGUAGE, "hi");
    expect(manager.get("s1")?.id).toBe("s1");
    expect(manager.get("nonexistent")).toBeUndefined();
  });

  it("getOrCreate returns existing without overwriting", () => {
    const c1 = manager.create("s1", AUTO_LANGUAGE, "hi");
    const c2 = manager.getOrCreate("s1", "mr", "mr");
    expect(c2).toBe(c1);
    expect(c2.getPreferredLanguage()).toBe("hi");
  });

  it("addUserMessage appends to the conversation", () => {
    const conv = manager.create("s1", AUTO_LANGUAGE, "hi");
    conv.addUserMessage("hello", "en");
    expect(conv.getAll().length).toBe(1);
    expect(conv.getAll()[0]?.content).toBe("hello");
  });

  it("addAssistantMessage appends to the conversation", () => {
    const conv = manager.create("s1", AUTO_LANGUAGE, "hi");
    conv.addAssistantMessage("नमस्ते", "hi");
    expect(conv.getAll().length).toBe(1);
    expect(conv.getAll()[0]?.role).toBe("assistant");
  });

  it("getContext returns the last N messages", () => {
    const conv = manager.create("s1", AUTO_LANGUAGE, "hi");
    for (let i = 0; i < 20; i++) {
      conv.addUserMessage(`msg ${i}`, "en");
    }
    expect(conv.getAll().length).toBe(20);
    expect(conv.getContext(5).length).toBe(5);
    expect(conv.getContext(5)[0]?.content).toBe("msg 15");
  });

  it("setLanguageSetting updates the setting", () => {
    const conv = manager.create("s1", AUTO_LANGUAGE, "hi");
    conv.setLanguageSetting("mr");
    expect(conv.getLanguageSetting()).toBe("mr");
  });

  it("adoptDetectedLanguage switches preferred when AUTO + high confidence", () => {
    const conv = manager.create("s1", AUTO_LANGUAGE, "hi");
    const adopted = conv.adoptDetectedLanguage("mr", 0.95, 0.6);
    expect(adopted).toBe(true);
    expect(conv.getPreferredLanguage()).toBe("mr");
  });

  it("adoptDetectedLanguage does not switch when AUTO + low confidence", () => {
    const conv = manager.create("s1", AUTO_LANGUAGE, "hi");
    const adopted = conv.adoptDetectedLanguage("mr", 0.4, 0.6);
    expect(adopted).toBe(false);
    expect(conv.getPreferredLanguage()).toBe("hi");
  });

  it("adoptDetectedLanguage does not switch when language is fixed", () => {
    const conv = manager.create("s1", "hi", "hi");
    const adopted = conv.adoptDetectedLanguage("mr", 0.99, 0.6);
    expect(adopted).toBe(false);
    expect(conv.getPreferredLanguage()).toBe("hi");
  });

  it("remove deletes the conversation", () => {
    manager.create("s1", AUTO_LANGUAGE, "hi");
    manager.remove("s1");
    expect(manager.get("s1")).toBeUndefined();
  });

  it("clear removes all conversations", () => {
    manager.create("s1", AUTO_LANGUAGE, "hi");
    manager.create("s2", AUTO_LANGUAGE, "mr");
    manager.clear();
    expect(manager.get("s1")).toBeUndefined();
    expect(manager.get("s2")).toBeUndefined();
  });

  it("reset clears messages but keeps language", () => {
    const conv = manager.create("s1", AUTO_LANGUAGE, "hi");
    conv.addUserMessage("hello", "en");
    conv.addAssistantMessage("hi there", "en");
    conv.reset();
    expect(conv.getAll().length).toBe(0);
    expect(conv.getPreferredLanguage()).toBe("hi");
  });
});
