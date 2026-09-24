"use client";
import { AUTO_LANGUAGE, LANGUAGES, type LanguageCode, type LanguageSetting } from "@airco-talks/shared";
import type { TranslatorSettings } from "@/hooks/useVoiceSession";

interface Props {
  open: boolean;
  settings: TranslatorSettings;
  voices: string[];
  onChange: (next: Partial<TranslatorSettings>) => void;
  onClose: () => void;
}

/**
 * Settings panel: "Your language" (the device holder — always fixed) and the
 * customer's language (fixed, or AUTO to detect whatever they speak and
 * remember it for your replies).
 */
export function SettingsPanel({ open, settings, voices, onChange, onClose }: Props) {
  if (!open) return null;

  const theirIsAuto = settings.theirLanguage === AUTO_LANGUAGE;
  const swap = () => {
    if (settings.theirLanguage === AUTO_LANGUAGE) return;
    onChange({ myLanguage: settings.theirLanguage, theirLanguage: settings.myLanguage });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-line/10 bg-panel p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-strong">Languages</h2>
          <button type="button" onClick={onClose} aria-label="Close settings" className="rounded-md p-1 text-muted hover:text-body">
            ✕
          </button>
        </div>

        <label className="mb-1 block text-xs uppercase tracking-wider text-muted" htmlFor="my-lang-select">
          Your language
        </label>
        <select
          id="my-lang-select"
          value={settings.myLanguage}
          onChange={(e) => onChange({ myLanguage: e.target.value as LanguageCode })}
          className="mb-3 w-full rounded-lg border border-line/10 bg-ink px-3 py-2 text-strong outline-none focus:border-accent"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name} — {l.endonym}
            </option>
          ))}
        </select>

        <div className="mb-3 flex items-center gap-3">
          <span className="h-px flex-1 bg-line/15" aria-hidden />
          <button
            type="button"
            onClick={swap}
            disabled={theirIsAuto}
            className="flex items-center gap-1.5 rounded-full border border-line/15 px-3 py-1 text-xs text-muted transition hover:border-accent/40 hover:text-strong disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Swap languages"
            title={theirIsAuto ? "Swap is unavailable while the customer's language is auto-detected" : "Swap languages"}
          >
            <SwapIcon />
            Swap
          </button>
          <span className="h-px flex-1 bg-line/15" aria-hidden />
        </div>

        <label className="mb-1 block text-xs uppercase tracking-wider text-muted" htmlFor="their-lang-select">
          Customer language
        </label>
        <select
          id="their-lang-select"
          value={settings.theirLanguage}
          onChange={(e) => onChange({ theirLanguage: e.target.value as LanguageSetting })}
          className="mb-4 w-full rounded-lg border border-line/10 bg-ink px-3 py-2 text-strong outline-none focus:border-accent"
        >
          <option value={AUTO_LANGUAGE}>Auto-detect (recommended)</option>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name} — {l.endonym}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs uppercase tracking-wider text-muted" htmlFor="voice-select">
          Voice
        </label>
        <select
          id="voice-select"
          value={settings.voice}
          onChange={(e) => onChange({ voice: e.target.value })}
          className="w-full rounded-lg border border-line/10 bg-ink px-3 py-2 text-strong outline-none focus:border-accent"
        >
          <option value="">Default for language</option>
          {voices.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <p className="mt-4 text-xs text-muted">
          {theirIsAuto
            ? "Select your language and start talking. Whatever language the customer speaks is detected automatically, translated for you, and your replies are spoken back in their language."
            : "Speak in your language — Airco Talks translates aloud into the customer's language, and translates their replies back for you."}
        </p>
      </div>
    </div>
  );
}

function SwapIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 4v13m0 0-3-3m3 3 3-3M17 20V7m0 0-3 3m3-3 3 3" />
    </svg>
  );
}
