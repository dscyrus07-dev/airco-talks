import { describe, it, expect } from "vitest";
import {
  parseClientMessage,
  isServerMessage,
} from "@airco-talks/shared";

// Valid UUID for tests (not a real one, but RFC 4122 formatted).
const UUID = "12345678-1234-4234-8234-123456789abc";

describe("WebSocket protocol", () => {
  describe("parseClientMessage", () => {
    it("parses a valid start_session message with a language pair", () => {
      const msg = { type: "start_session", myLanguage: "pa", theirLanguage: "mr", voice: "rohan" };
      const parsed = parseClientMessage(msg);
      expect(parsed.type).toBe("start_session");
    });

    it("parses a start_session with auto-detected customer language", () => {
      const msg = { type: "start_session", myLanguage: "hi", theirLanguage: "auto" };
      const parsed = parseClientMessage(msg);
      expect(parsed.type).toBe("start_session");
    });

    it("parses a start_session with explicit sessionId", () => {
      const msg = { type: "start_session", sessionId: UUID, myLanguage: "pa", theirLanguage: "mr" };
      const parsed = parseClientMessage(msg);
      expect(parsed.type).toBe("start_session");
      expect(parsed.sessionId).toBe(UUID);
    });

    it("parses an audio_chunk message", () => {
      const msg = { type: "audio_chunk", sessionId: UUID, data: "base64==" };
      const parsed = parseClientMessage(msg);
      expect(parsed.type).toBe("audio_chunk");
      if (parsed.type === "audio_chunk") {
        expect(parsed.data).toBe("base64==");
      }
    });

    it("parses an interrupt message", () => {
      const msg = { type: "interrupt", sessionId: UUID };
      expect(parseClientMessage(msg).type).toBe("interrupt");
    });

    it("parses a stop_session message", () => {
      const msg = { type: "stop_session", sessionId: UUID };
      expect(parseClientMessage(msg).type).toBe("stop_session");
    });

    it("parses an update_config message", () => {
      const msg = { type: "update_config", sessionId: UUID, myLanguage: "hi", theirLanguage: "en", voice: "ritu" };
      const parsed = parseClientMessage(msg);
      expect(parsed.type).toBe("update_config");
    });

    it("rejects an unknown message type", () => {
      expect(() => parseClientMessage({ type: "bogus" })).toThrow();
    });

    it("rejects a non-object input", () => {
      expect(() => parseClientMessage("not an object")).toThrow();
      expect(() => parseClientMessage(null)).toThrow();
      expect(() => parseClientMessage(42)).toThrow();
    });

    it("rejects an audio_chunk missing data", () => {
      expect(() => parseClientMessage({ type: "audio_chunk", sessionId: UUID })).toThrow();
    });

    it("rejects a start_session with invalid language code", () => {
      const msg = { type: "start_session", myLanguage: "xx", theirLanguage: "mr" };
      expect(() => parseClientMessage(msg)).toThrow();
    });

    it("rejects a start_session missing the language pair", () => {
      expect(() => parseClientMessage({ type: "start_session", myLanguage: "pa" })).toThrow();
      expect(() => parseClientMessage({ type: "start_session" })).toThrow();
    });

    it("rejects a sessionId that is not a UUID", () => {
      const msg = { type: "interrupt", sessionId: "not-a-uuid" };
      expect(() => parseClientMessage(msg)).toThrow();
    });

    it("rejects an audio_chunk with empty data", () => {
      const msg = { type: "audio_chunk", sessionId: UUID, data: "" };
      expect(() => parseClientMessage(msg)).toThrow();
    });
  });

  describe("isServerMessage", () => {
    it("returns true for a valid transcript_partial", () => {
      const msg = { type: "transcript_partial", sessionId: UUID, text: "hello", language: "hi", side: "my" };
      expect(isServerMessage(msg)).toBe(true);
    });

    it("returns true for a valid transcript_final with side", () => {
      const msg = { type: "transcript_final", sessionId: UUID, text: "hello", language: "hi", confidence: 0.9, side: "their" };
      expect(isServerMessage(msg)).toBe(true);
    });

    it("returns true for a valid ai_response_started with side", () => {
      const msg = { type: "ai_response_started", sessionId: UUID, side: "my" };
      expect(isServerMessage(msg)).toBe(true);
    });

    it("returns true for a valid audio_chunk", () => {
      const msg = { type: "audio_chunk", sessionId: UUID, data: "abc=", sampleRate: 24000 };
      expect(isServerMessage(msg)).toBe(true);
    });

    it("returns true for a valid latency message", () => {
      const msg = {
        type: "latency",
        sessionId: UUID,
        speechEndToFirstAudioMs: 450,
        llmFirstTokenMs: 120,
        ttsFirstAudioMs: 200,
      };
      expect(isServerMessage(msg)).toBe(true);
    });

    it("returns true for an error message", () => {
      const msg = { type: "error", code: "X", message: "y", recoverable: true };
      expect(isServerMessage(msg)).toBe(true);
    });

    it("returns false for an unknown server message type", () => {
      expect(isServerMessage({ type: "bogus" })).toBe(false);
    });

    it("returns false for non-object input", () => {
      expect(isServerMessage(123)).toBe(false);
      expect(isServerMessage(null)).toBe(false);
      expect(isServerMessage("string")).toBe(false);
    });

    it("returns false for a message missing required fields", () => {
      expect(isServerMessage({ type: "transcript_partial", sessionId: UUID })).toBe(false);
    });

    it("returns false for a transcript_partial with an invalid side", () => {
      const msg = { type: "transcript_partial", sessionId: UUID, text: "hi", language: "hi", side: "other" };
      expect(isServerMessage(msg)).toBe(false);
    });
  });
});
