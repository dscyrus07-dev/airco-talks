"use client";

/**
 * Fixed ambient background: deep navy base (from body), soft radial glows,
 * faint orbital curves and sparse particle dots. Purely decorative — kept
 * extremely subtle so the interface stays the focus. Respects reduced motion
 * via the global CSS override.
 */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* Ambient glow around the microphone area */}
      <div className="absolute left-1/2 top-[22%] h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(37_99_235/0.16),transparent)] blur-2xl" />
      {/* Indigo/violet corner ambience */}
      <div className="absolute -left-24 bottom-[-120px] h-[380px] w-[380px] rounded-full bg-indigo-600/10 blur-[110px]" />
      <div className="absolute right-[-120px] top-[-80px] h-[420px] w-[420px] rounded-full bg-violet-600/10 blur-[120px]" />

      {/* Faint orbital curves */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.07]" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <circle cx="720" cy="330" r="300" fill="none" stroke="#60a5fa" strokeWidth="1" />
        <circle cx="1440" cy="720" r="420" fill="none" stroke="rgb(139 92 246)" strokeWidth="1.2" />
        <circle cx="60" cy="620" r="220" fill="none" stroke="rgb(59 130 246)" strokeWidth="1" />
      </svg>

      {/* Sparse particles */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-blue-300"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            opacity: p.opacity ?? 0.4,
            animation: `breathe ${p.dur ?? 6}s ease-in-out ${p.delay ?? 0}s infinite`,
          }}
        />
      ))}

      <style>{`@keyframes breathe { 0%,100% { opacity: 0.25; transform: scale(1);} 50% { opacity: 0.7; transform: scale(1.25);} }`}</style>
    </div>
  );
}

interface Particle {
  x: number;
  y: number;
  size: number;
  delay?: number;
  dur?: number;
  opacity?: number;
}

const PARTICLES: Particle[] = [
  { x: 12, y: 22, size: 2, delay: 0 },
  { x: 22, y: 64, size: 1.5, delay: 0.8 },
  { x: 31, y: 12, size: 2 },
  { x: 38, y: 74, size: 1.5, delay: 1.4 },
  { x: 47, y: 30, size: 2 },
  { x: 55, y: 30, size: 1.5, delay: 0.5 },
  { x: 58, y: 82, size: 2, delay: 2 },
  { x: 68, y: 18, size: 1.5 },
  { x: 72, y: 62, size: 2, delay: 1.2 },
  { x: 76, y: 58, size: 1.5, delay: 0.4 },
  { x: 72, y: 82, size: 2, delay: 1.6 },
  { x: 84, y: 38, size: 1.5 },
  { x: 90, y: 66, size: 2, delay: 2.4 },
  { x: 92, y: 18, size: 1.5, delay: 1.1 },
];
