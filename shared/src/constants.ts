/**
 * Centralized constants — no magic numbers/strings scattered across the app.
 */
import { VoiceSessionState } from "./state/index.js";

export const APP_NAME = "Airco Talks";
export const APP_TAGLINE = "Two-way voice translator for Indian languages";

/** WebSocket reconnect backoff (milliseconds). */
export const RECONNECT_DELAY_MS = 1000;
export const RECONNECT_MAX_DELAY_MS = 8000;

/** Server request timeouts. */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Audio pipeline. */
export const AUDIO_SAMPLE_RATE = 16000;
/** Bytes per PCM audio chunk sent to STT (~100ms of 16kHz 16-bit mono). */
export const STT_CHUNK_MS = 100;

/** Conversation context window (max recent messages sent to the LLM). */
export const MAX_CONTEXT_MESSAGES = 12;

/** Confidence threshold below which a newly detected language is NOT adopted. */
export const LANGUAGE_CONFIDENCE_THRESHOLD = 0.6;

/** AI speaking — silence after which we consider the AI turn naturally over. */
export const AI_TURN_TIMEOUT_MS = 15_000;

/** State → human-readable label for the voice-first UI. */
export const STATE_LABELS: ReadonlyMap<VoiceSessionState, string> = new Map([
  [VoiceSessionState.IDLE, "Tap to speak"],
  [VoiceSessionState.CONNECTING, "Connecting…"],
  [VoiceSessionState.LISTENING, "Listening…"],
  [VoiceSessionState.USER_SPEAKING, "Listening…"],
  [VoiceSessionState.PROCESSING, "Translating…"],
  [VoiceSessionState.AI_SPEAKING, "Speaking translation…"],
  [VoiceSessionState.USER_INTERRUPT, "Listening…"],
  [VoiceSessionState.ERROR, "Something went wrong"],
  [VoiceSessionState.ENDED, "Conversation ended"],
]);
