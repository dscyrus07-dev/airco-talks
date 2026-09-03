import { VoiceSessionState, isValidTransition } from "@dhvani/shared";
import { AppError } from "@dhvani/shared";

/**
 * Lightweight state machine for the voice session. Guards against illegal
 * transitions (e.g. IDLE → AI_SPEAKING) and emits nothing itself — the
 * orchestrator wires state changes to the event bus / WebSocket.
 */
export class VoiceSessionStateMachine {
  private current: VoiceSessionState = VoiceSessionState.IDLE;

  get state(): VoiceSessionState {
    return this.current;
  }

  canTransition(to: VoiceSessionState): boolean {
    return isValidTransition(this.current, to);
  }

  transition(to: VoiceSessionState): VoiceSessionState {
    if (!isValidTransition(this.current, to)) {
      throw new AppError("INVALID_STATE_TRANSITION", `Cannot transition from ${this.current} to ${to}`, {
        recoverable: false,
        metadata: { from: this.current, to },
      });
    }
    const from = this.current;
    this.current = to;
    return from;
  }

  /** Convenience: transition only if allowed, otherwise no-op. Returns whether it changed. */
  tryTransition(to: VoiceSessionState): boolean {
    if (!isValidTransition(this.current, to)) return false;
    this.current = to;
    return true;
  }

  reset(): void {
    this.current = VoiceSessionState.IDLE;
  }
}
