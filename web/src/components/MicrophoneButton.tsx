"use client";
import { motion } from "framer-motion";
import { VoiceSessionState } from "@airco-talks/shared";

interface Props {
  state: VoiceSessionState;
  disabled?: boolean;
  /** 0..1 real microphone level (drives glow + ring activity). */
  level?: number;
  /** Smaller orb used in conversation mode so history stays the focus. */
  compact?: boolean;
  onClick: () => void;
}

/**
 * The primary voice-first control: an illuminated glass orb with layered
 * rings, ambient glow and state-reactive animation. Accessible: keyboard
 * activatable, aria-label describes the current action.
 */
export function MicrophoneButton({ state, disabled, compact = false, onClick }: Props) {
  const isActive =
    state === VoiceSessionState.LISTENING ||
    state === VoiceSessionState.USER_SPEAKING ||
    state === VoiceSessionState.USER_INTERRUPT;
  const isSpeaking = state === VoiceSessionState.AI_SPEAKING;
  const isBusy = state === VoiceSessionState.PROCESSING || state === VoiceSessionState.CONNECTING;

  const label = isActive ? "Stop listening" : isSpeaking ? "Interrupt and speak" : "Tap to speak";
  const intensity = isActive ? 1 : isSpeaking ? 0.85 : 0.55;

  const outer = compact ? "h-36 w-36 sm:h-40 sm:w-40" : "h-60 w-60 sm:h-64 sm:w-64";
  const ringOuter = compact ? "inset-2" : "inset-3";
  const ringInner = compact ? "inset-5" : "inset-8";
  const pulse = compact ? "inset-7" : "inset-10";
  const core = compact ? "h-20 w-20" : "h-32 w-32";
  const iconSize = compact ? 26 : 36;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isActive}
      className={`group relative grid place-items-center rounded-full outline-none transition focus-visible:ring-4 focus-visible:ring-accentSoft/50 disabled:opacity-40 ${outer}`}
    >
      {/* Ambient outer glow */}
      <motion.span
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgb(var(--accent-rgb)/0.4)_0%,rgb(139_92_246/0.18)_45%,transparent_72%)] blur-2xl"
        animate={{ opacity: [0.45 * intensity, 0.85 * intensity, 0.45 * intensity], scale: [1, 1.07, 1] }}
        transition={{ duration: isActive ? 1.6 : 4.5, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      {/* Outer thin ring */}
      <span className={`absolute rounded-full border border-accent/25 ${ringOuter}`} aria-hidden />
      {/* Secondary ring */}
      <motion.span
        className={`absolute rounded-full border border-accentSoft/20 ${ringInner}`}
        animate={isActive ? { scale: [1, 1.05, 1], opacity: [0.5, 0.9, 0.5] } : { scale: 1, opacity: 0.35 }}
        transition={{ duration: isActive ? 1.4 : 4, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      {/* Pulse ring while active/speaking */}
      {(isActive || isSpeaking) && (
        <span
          className={`absolute rounded-full ${isActive ? "bg-danger" : "bg-accentSoft"} opacity-25 animate-pulseRing ${pulse}`}
          aria-hidden
        />
      )}

      {/* Illuminated core */}
      <motion.span
        className={`relative grid place-items-center rounded-full bg-gradient-to-br from-[#2563eb] via-indigo-500 to-violet-500 shadow-[0_0_70px_-12px_rgb(var(--accent-rgb)/0.9),inset_0_2px_10px_rgb(255_255_255/0.25)] ${core}`}
        animate={{ scale: isActive ? [1, 1.045, 1] : [1, 1.012, 1] }}
        transition={{ duration: isActive ? 1.2 : 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-transparent to-white/15" aria-hidden />
        {isBusy ? <Spinner size={iconSize} /> : isSpeaking ? <SpeakerIcon size={iconSize} /> : <MicIcon size={iconSize} />}
      </motion.span>
    </button>
  );
}

function MicIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v4" />
      <path d="M8 22h8" />
    </svg>
  );
}

function SpeakerIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18 5a9 9 0 0 1 0 14" />
    </svg>
  );
}

function Spinner({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
