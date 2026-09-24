"use client";
import { VoiceSessionState, STATE_LABELS } from "@airco-talks/shared";

interface Props {
  state: VoiceSessionState;
  detectedLanguage?: string | null;
  languageEndonym?: string;
}

const STATE_DOT: Partial<Record<VoiceSessionState, string>> = {
  [VoiceSessionState.LISTENING]: "bg-danger",
  [VoiceSessionState.USER_SPEAKING]: "bg-danger",
  [VoiceSessionState.PROCESSING]: "bg-warn",
  [VoiceSessionState.AI_SPEAKING]: "bg-accentSoft",
  [VoiceSessionState.ERROR]: "bg-danger",
  [VoiceSessionState.IDLE]: "bg-muted",
  [VoiceSessionState.CONNECTING]: "bg-warn",
};

/** Shows the current conversation phase + detected language badge. */
export function StateIndicator({ state, detectedLanguage, languageEndonym }: Props) {
  const label = STATE_LABELS.get(state) ?? "Tap to speak";
  const dot = STATE_DOT[state] ?? "bg-muted";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 text-sm text-body">
        <span className={`h-2.5 w-2.5 rounded-full ${dot} ${state === VoiceSessionState.LISTENING || state === VoiceSessionState.USER_SPEAKING ? "animate-pulse" : ""}`} />
        <span aria-live="polite">{label}</span>
      </div>
      {detectedLanguage ? (
        <div className="rounded-full border border-line/10 bg-wash/5 px-3 py-1 text-xs text-body">
          <span aria-label={`Detected language: ${detectedLanguage}`}>
            {languageEndonym ? languageEndonym : detectedLanguage}
          </span>
        </div>
      ) : null}
    </div>
  );
}
