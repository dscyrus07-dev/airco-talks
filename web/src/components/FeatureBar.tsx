"use client";

const FEATURES = [
  {
    title: "Two-Way Translation",
    description: "Both of you speak your own language",
    icon: GlobeIcon,
  },
  {
    title: "10 Indian Languages",
    description: "Punjabi, Marathi, Tamil & more",
    icon: LanguagesIcon,
  },
  {
    title: "Instant Speech",
    description: "Translated aloud as you talk",
    icon: WaveIcon,
  },  {
    title: "Secure & Private",
    description: "Audio is never stored",
    icon: ShieldIcon,
  },
] as const;

/** Wide glass panel with four product features separated by subtle dividers. */
export function FeatureBar() {
  return (
    <section className="glass mx-auto w-full max-w-4xl rounded-2xl px-2 py-4" aria-label="Product features">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-0 xl:grid-cols-4">
        {FEATURES.map(({ title, description, icon: Icon }, i) => (
          <li
            key={title}
            className={`flex items-center gap-3 px-4 sm:justify-center ${
              i > 0 ? "sm:border-l sm:border-line/15" : ""
            }`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accentSoft" aria-hidden>
              <Icon />
            </span>
            <span>
              <span className="block text-[13px] font-medium text-strong">{title}</span>
              <span className="block text-[11px] text-muted">{description}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GlobeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" />
    </svg>
  );
}

function LanguagesIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5h9M8.5 3v2M11 5c-.7 4-3.2 7-6.5 9M6 9.5c1.5 2.5 3.7 4.2 6 5" />
      <path d="m13.5 21 4-9 4 9M14.8 18h5.4" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <path d="M4 10v4M8 7v10M12 5v14M16 7v10M20 10v4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
