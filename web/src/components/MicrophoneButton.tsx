"use client";
import { motion } from "framer-motion";
import { VoiceSessionState } from "@dhvani/shared";

interface Props {
  state: VoiceSessionState;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * The primary voice-first control. A large circular button whose appearance
 * reflects the session state. Accessible: keyboard-activatable with an
 * aria-label that describes the current action.
 */
export function MicrophoneButton({ state, disabled, onClick }: Props) {
  const isActive =
    state === VoiceSessionState.LISTENING ||
    state === VoiceSessionState.USER_SPEAKING ||
    state === VoiceSessionState.USER_INTERRUPT;
  const isSpeaking = state === VoiceSessionState.AI_SPEAKING;
  const isProcessing = state === VoiceSessionState.PROCESSING || state === VoiceSessionState.CONNECTING;

  const ringColor = isSpeaking ? "bg-accentSoft" : isActive ? "bg-danger" : "bg-accent";
  const coreColor = isSpeaking ? "bg-accent" : isActive ? "bg-danger" : "bg-accent";

  const label = isActive ? "Stop listening" : isSpeaking ? "Interrupt and speak" : "Tap to speak";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isActive}
      className="relative flex h-40 w-40 items-center justify-center rounded-full outline-none transition focus-visible:ring-4 focus-visible:ring-accentSoft/60 disabled:opacity-40"
    >
      {(isActive || isSpeaking) && (
        <span
          className={`absolute inset-0 rounded-full ${ringColor} opacity-30 animate-pulseRing`}
          aria-hidden
        />
      )}
      <motion.span
        className={`relative flex h-28 w-28 items-center justify-center rounded-full ${coreColor} shadow-lg shadow-accent/30`}
        animate={{ scale: isActive ? [1, 1.05, 1] : 1 }}
        transition={{ repeat: isActive ? Infinity : 0, duration: 1.2 }}
      >
        {isProcessing ? (
          <Spinner />
        ) : isSpeaking ? (
          <SpeakerIcon />
        ) : (
          <MicIcon />
        )}
      </motion.span>
    </button>
  );
}

function MicIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v4" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18 5a9 9 0 0 1 0 14" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
