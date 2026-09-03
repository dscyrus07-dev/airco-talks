"use client";
import { motion } from "framer-motion";
import { VoiceSessionState } from "@dhvani/shared";

interface Props {
  state: VoiceSessionState;
  /** 0..1 input level (when listening) or output indicator (when speaking). */
  level?: number;
}

/**
 * Subtle audio visualization. Bars animate while listening or speaking; idle
 * state shows a calm, low-amplitude shimmer. Respects prefers-reduced-motion
 * via the global CSS override.
 */
export function AudioWaveform({ state, level = 0 }: Props) {
  const active =
    state === VoiceSessionState.USER_SPEAKING ||
    state === VoiceSessionState.LISTENING ||
    state === VoiceSessionState.AI_SPEAKING;
  const bars = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <div className="flex h-12 items-center justify-center gap-1.5" aria-hidden>
      {bars.map((i) => {
        const center = Math.abs(i - bars.length / 2 + 0.5);
        const base = active ? 6 + level * 34 : 4;
        const height = base + (active ? Math.sin((i + 1) * 1.3) * 8 + (1 - center / bars.length) * level * 20 : 0);
        return (
          <motion.span
            key={i}
            className="w-1 rounded-full bg-accentSoft/80"
            animate={{ height: Math.max(3, height) }}
            transition={{ duration: 0.12 }}
          />
        );
      })}
    </div>
  );
}
