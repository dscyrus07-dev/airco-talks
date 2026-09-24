"use client";

interface VoiceWaveProps {
  /** 0..1 real microphone level while listening; 0 when idle. */
  level: number;
  /** Whether the session is actively listening/speaking. */
  active: boolean;
}

/**
 * Elegant luminous voice-energy wave flowing horizontally behind the mic orb.
 * Two layered sine strokes (blue + violet) with soft glow and particle dots.
 * Amplitude follows the real mic level; idle keeps a gentle breathing motion.
 */
export function VoiceWave({ level, active }: VoiceWaveProps) {
  const amp = active ? 10 + level * 26 : 6;
  const width = 900;
  const mid = 60;
  const points: string[] = [];
  for (let x = 0; x <= width; x += 12) {
    const t = x / width;
    const envelope = Math.sin(Math.PI * t); // fade toward edges
    const y = Math.sin(t * Math.PI * 3) * amp * envelope;
    points.push(`${x.toFixed(1)},${(60 + y).toFixed(1)}`);
  }
  const d = `M ${points.join(" L ")}`;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2" aria-hidden>
      <svg viewBox="0 0 900 120" className="h-28 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="waveGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(59 130 246 / 0)" />
            <stop offset="18%" stopColor="rgb(59 130 246 / 0.75)" />
            <stop offset="50%" stopColor="rgb(99 102 241 / 0.9)" />
            <stop offset="82%" stopColor="rgb(139 92 246 / 0.75)" />
            <stop offset="100%" stopColor="rgb(139 92 246 / 0)" />
          </linearGradient>
          <linearGradient id="waveGradSoft" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(34 211 238 / 0)" />
            <stop offset="50%" stopColor="rgb(34 211 238 / 0.35)" />
            <stop offset="100%" stopColor="rgb(139 92 246 / 0)" />
          </linearGradient>
          <filter id="waveGlow" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Soft under-glow stroke */}
        <path d={d} fill="none" stroke="url(#waveGradSoft)" strokeWidth="5" style={{ filter: "blur(6px)" }} />
        {/* Main luminous stroke */}
        <path d={d} fill="none" stroke="url(#waveGrad)" strokeWidth="1.6" style={{ filter: "url(#waveGlow)" }} />

        {/* Particle dots riding the wave */}
        {[90, 210, 330, 570, 690, 810].map((x, i) => {
          const t = x / width;
          const y = 60 + Math.sin(t * Math.PI * 3) * amp * Math.sin(Math.PI * t);
          return (
            <circle key={i} cx={x} cy={y} r={1.6} fill="rgb(147 197 253 / 0.8)">
              <animate attributeName="opacity" values="0.15;0.9;0.15" dur={`${2.4 + (i % 3) * 0.7}s`} repeatCount="indefinite" />
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
