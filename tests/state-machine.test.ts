import { describe, it, expect } from "vitest";
import {
  VoiceSessionState,
  isValidTransition,
  STATE_LABELS,
} from "@airco-talks/shared";

describe("VoiceSessionState", () => {
  describe("isValidTransition", () => {
    it("allows IDLE → CONNECTING", () => {
      expect(isValidTransition(VoiceSessionState.IDLE, VoiceSessionState.CONNECTING)).toBe(true);
    });

    it("allows IDLE → ENDED", () => {
      expect(isValidTransition(VoiceSessionState.IDLE, VoiceSessionState.ENDED)).toBe(true);
    });

    it("allows CONNECTING → LISTENING", () => {
      expect(isValidTransition(VoiceSessionState.CONNECTING, VoiceSessionState.LISTENING)).toBe(true);
    });

    it("allows CONNECTING → ERROR", () => {
      expect(isValidTransition(VoiceSessionState.CONNECTING, VoiceSessionState.ERROR)).toBe(true);
    });

    it("allows LISTENING → USER_SPEAKING", () => {
      expect(isValidTransition(VoiceSessionState.LISTENING, VoiceSessionState.USER_SPEAKING)).toBe(true);
    });

    it("allows USER_SPEAKING → PROCESSING", () => {
      expect(isValidTransition(VoiceSessionState.USER_SPEAKING, VoiceSessionState.PROCESSING)).toBe(true);
    });

    it("allows USER_SPEAKING → LISTENING (user stopped without speaking)", () => {
      expect(isValidTransition(VoiceSessionState.USER_SPEAKING, VoiceSessionState.LISTENING)).toBe(true);
    });

    it("allows PROCESSING → AI_SPEAKING", () => {
      expect(isValidTransition(VoiceSessionState.PROCESSING, VoiceSessionState.AI_SPEAKING)).toBe(true);
    });

    it("allows PROCESSING → LISTENING (empty response)", () => {
      expect(isValidTransition(VoiceSessionState.PROCESSING, VoiceSessionState.LISTENING)).toBe(true);
    });

    it("allows AI_SPEAKING → LISTENING (turn complete)", () => {
      expect(isValidTransition(VoiceSessionState.AI_SPEAKING, VoiceSessionState.LISTENING)).toBe(true);
    });

    it("allows barge-in: AI_SPEAKING → USER_INTERRUPT", () => {
      expect(isValidTransition(VoiceSessionState.AI_SPEAKING, VoiceSessionState.USER_INTERRUPT)).toBe(true);
    });

    it("allows USER_INTERRUPT → PROCESSING", () => {
      expect(isValidTransition(VoiceSessionState.USER_INTERRUPT, VoiceSessionState.PROCESSING)).toBe(true);
    });

    it("allows USER_INTERRUPT → USER_SPEAKING", () => {
      expect(isValidTransition(VoiceSessionState.USER_INTERRUPT, VoiceSessionState.USER_SPEAKING)).toBe(true);
    });

    it("allows ERROR → CONNECTING (retry)", () => {
      expect(isValidTransition(VoiceSessionState.ERROR, VoiceSessionState.CONNECTING)).toBe(true);
    });

    it("allows ERROR → IDLE (reset)", () => {
      expect(isValidTransition(VoiceSessionState.ERROR, VoiceSessionState.IDLE)).toBe(true);
    });

    it("allows ENDED → IDLE", () => {
      expect(isValidTransition(VoiceSessionState.ENDED, VoiceSessionState.IDLE)).toBe(true);
    });

    it("disallows IDLE → AI_SPEAKING (skip phases)", () => {
      expect(isValidTransition(VoiceSessionState.IDLE, VoiceSessionState.AI_SPEAKING)).toBe(false);
    });

    it("allows LISTENING → PROCESSING (VAD speech_end may fire without speech_start)", () => {
      expect(isValidTransition(VoiceSessionState.LISTENING, VoiceSessionState.PROCESSING)).toBe(true);
    });

    it("disallows IDLE → ERROR (must connect first)", () => {
      expect(isValidTransition(VoiceSessionState.IDLE, VoiceSessionState.ERROR)).toBe(false);
    });

    it("disallows IDLE → LISTENING (must connect first)", () => {
      expect(isValidTransition(VoiceSessionState.IDLE, VoiceSessionState.LISTENING)).toBe(false);
    });

    it("disallows ENDED → CONNECTING (must reset to IDLE first)", () => {
      expect(isValidTransition(VoiceSessionState.ENDED, VoiceSessionState.CONNECTING)).toBe(false);
    });
  });

  describe("STATE_LABELS", () => {
    it("has a human-readable label for every state", () => {
      for (const state of Object.values(VoiceSessionState)) {
        expect(STATE_LABELS.get(state)).toBeTruthy();
      }
    });
  });
});
