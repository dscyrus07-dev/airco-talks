"use client";
import type { ReactNode } from "react";
import type { LanguageCode } from "@airco-talks/shared";

interface PairPreset {
  title: string;
  description: string;
  myLanguage: LanguageCode;
  theirLanguage: LanguageCode;
  icon: ReactNode;
}

const PRESETS: PairPreset[] = [
  {
    title: "Punjabi ↔ Marathi",
    description: "ਪੰਜਾਬੀ ↔ मराठी",
    myLanguage: "pa",
    theirLanguage: "mr",
    icon: <GlobeIcon />,
  },
  {
    title: "Hindi ↔ English",
    description: "हिन्दी ↔ English",
    myLanguage: "hi",
    theirLanguage: "en",
    icon: <GlobeIcon />,
  },
  {
    title: "Marathi ↔ Hindi",
    description: "मराठी ↔ हिन्दी",
    myLanguage: "mr",
    theirLanguage: "hi",
    icon: <GlobeIcon />,
  },
  {
    title: "Tamil ↔ Telugu",
    description: "தமிழ் ↔ తెలుగు",
    myLanguage: "ta",
    theirLanguage: "te",
    icon: <GlobeIcon />,
  },
];

interface QuickPromptsProps {
  /** Starts a real voice session (reuses the existing mic flow) when idle. */
  onPrompt: () => void;
  /** Applies a language pair preset. */
  onPickPair: (myLanguage: LanguageCode, theirLanguage: LanguageCode) => void;
  activeMyLanguage: LanguageCode;
  activeTheirLanguage: LanguageCode | "auto";
}

/**
 * Language pair presets. Picking a pair configures the translator; starting a
 * session still needs the microphone button.
 */
export function QuickPrompts({ onPrompt, onPickPair, activeMyLanguage, activeTheirLanguage }: QuickPromptsProps) {
  return (
    <section className="mx-auto w-full max-w-4xl px-4" aria-label="Language pair presets">
      <div className="mb-5 flex items-center gap-4">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-line/25" aria-hidden />
        <h2 className="text-xs uppercase tracking-[0.2em] text-muted">Quick language pairs</h2>
        <span className="h-px flex-1 bg-gradient-to-l from-line/25 to-transparent" aria-hidden />
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PRESETS.map((p) => {
          const active = p.myLanguage === activeMyLanguage && p.theirLanguage === activeTheirLanguage;
          return (
            <li key={p.title}>
              <button
                type="button"
                onClick={() => {
                  onPickPair(p.myLanguage, p.theirLanguage);
                  onPrompt();
                }}
                className="glass group flex w-full items-start gap-3 rounded-xl p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_10px_30px_-12px_rgb(var(--accent-rgb)/0.45)] focus-visible:ring-2 focus-visible:ring-accentSoft/60"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accentSoft transition group-hover:shadow-[0_0_14px_rgb(var(--accent-rgb)/0.5)]" aria-hidden>
                  {p.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-snug text-strong">{p.title}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">{p.description}</span>
                </span>
                {active ? (
                  <span className="mt-1 shrink-0 rounded-full bg-ok/15 px-2 py-0.5 text-[10px] font-medium text-ok" aria-label="Active pair">
                    active
                  </span>
                ) : (
                  <span className="mt-1 shrink-0 text-muted opacity-0 transition duration-200 group-hover:translate-x-0.5 group-hover:text-accentSoft" aria-hidden>
                    <ArrowIcon />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}
