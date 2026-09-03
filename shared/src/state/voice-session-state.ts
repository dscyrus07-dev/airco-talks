/**
 * Voice session lifecycle states.
 *
 * The UI and backend share this enum so both sides agree on the conversation
 * phase. Transitions are validated by the state machine (see server/domain).
 */
export enum VoiceSessionState {
  /** No active session. */
  IDLE = "idle",
  /** Establishing the WebSocket / STT connection. */
  CONNECTING = "connecting",
  /** Mic open, listening for the user to start speaking. */
  LISTENING = "listening",
  /** User is actively speaking (receiving partial transcripts). */
  USER_SPEAKING = "user_speaking",
  /** User finished speaking; waiting for final transcript / preparing LLM. */
  PROCESSING = "processing",
  /** LLM is generating + TTS is streaming; AI audio is playing. */
  AI_SPEAKING = "ai_speaking",
  /** User interrupted the AI mid-speech (barge-in). */
  USER_INTERRUPT = "user_interrupt",
  /** Recoverable error; can transition back to CONNECTING. */
  ERROR = "error",
  /** Session explicitly ended. */
  ENDED = "ended",
}

/** All valid state transitions. Anything not listed is rejected. */
export const VALID_TRANSITIONS: ReadonlyMap<VoiceSessionState, readonly VoiceSessionState[]> =
  new Map<VoiceSessionState, readonly VoiceSessionState[]>([
    [VoiceSessionState.IDLE, [VoiceSessionState.CONNECTING, VoiceSessionState.ENDED]],
    [VoiceSessionState.CONNECTING, [VoiceSessionState.LISTENING, VoiceSessionState.ERROR, VoiceSessionState.ENDED]],
    [VoiceSessionState.LISTENING, [VoiceSessionState.USER_SPEAKING, VoiceSessionState.PROCESSING, VoiceSessionState.ERROR, VoiceSessionState.ENDED]],
    [VoiceSessionState.USER_SPEAKING, [VoiceSessionState.PROCESSING, VoiceSessionState.LISTENING, VoiceSessionState.ERROR, VoiceSessionState.ENDED]],
    [VoiceSessionState.PROCESSING, [VoiceSessionState.AI_SPEAKING, VoiceSessionState.LISTENING, VoiceSessionState.ERROR, VoiceSessionState.ENDED]],
    [VoiceSessionState.AI_SPEAKING, [VoiceSessionState.USER_INTERRUPT, VoiceSessionState.LISTENING, VoiceSessionState.ERROR, VoiceSessionState.ENDED]],
    [VoiceSessionState.USER_INTERRUPT, [VoiceSessionState.USER_SPEAKING, VoiceSessionState.PROCESSING, VoiceSessionState.ERROR, VoiceSessionState.ENDED]],
    [VoiceSessionState.ERROR, [VoiceSessionState.CONNECTING, VoiceSessionState.IDLE, VoiceSessionState.LISTENING, VoiceSessionState.ENDED]],
    [VoiceSessionState.ENDED, [VoiceSessionState.IDLE]],
  ]);

export function isValidTransition(from: VoiceSessionState, to: VoiceSessionState): boolean {
  const allowed = VALID_TRANSITIONS.get(from);
  return allowed !== undefined && allowed.includes(to);
}
