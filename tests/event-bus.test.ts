import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../server/src/domain/event-bus.js";
import type { VoiceEventName } from "../server/src/domain/events/voice-events.js";

describe("EventBus", () => {
  it("calls a subscribed handler when the event is emitted", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on("transcript_final", handler);

    bus.emit("transcript_final", {
      sessionId: "s1",
      text: "नमस्के",
      language: "mr",
      confidence: 0.95,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "s1", text: "नमस्के", language: "mr" }),
    );
    unsub();
  });

  it("supports multiple handlers for the same event", () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on("state_changed", h1);
    bus.on("state_changed", h2);

    bus.emit("state_changed", {
      sessionId: "s1",
      from: "listening" as never,
      to: "user_speaking" as never,
    });

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops further calls", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on("transcript_partial", handler);

    bus.emit("transcript_partial", { sessionId: "s1", text: "hi", language: "en" });
    unsub();
    bus.emit("transcript_partial", { sessionId: "s1", text: "bye", language: "en" });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call handlers for other events", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("transcript_final" as VoiceEventName, handler);

    bus.emit("transcript_partial", { sessionId: "s1", text: "hi", language: "en" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("handler errors do not break emit or other handlers", () => {
    const bus = new EventBus();
    const throwing = vi.fn(() => {
      throw new Error("boom");
    });
    const after = vi.fn();
    bus.on("transcript_final", throwing);
    bus.on("transcript_final", after);

    bus.emit("transcript_final", {
      sessionId: "s1",
      text: "test",
      language: "hi",
      confidence: 0.9,
    });

    expect(throwing).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("clear removes all handlers", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("transcript_final", handler);
    bus.clear();

    bus.emit("transcript_final", {
      sessionId: "s1",
      text: "test",
      language: "hi",
      confidence: 0.9,
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
