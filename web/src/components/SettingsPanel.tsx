"use client";
import { LANGUAGES, AUTO_LANGUAGE, type LanguageSetting } from "@dhvani/shared";

interface Props {
  open: boolean;
  settings: { language: LanguageSetting; voice: string };
  voices: string[];
  onChange: (next: Partial<{ language: LanguageSetting; voice: string }>) => void;
  onClose: () => void;
}

/** Lightweight settings panel: speaking language + voice selection. */
export function SettingsPanel({ open, settings, voices, onChange, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Settings</h2>
          <button type="button" onClick={onClose} aria-label="Close settings" className="rounded-md p-1 text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>

        <label className="mb-1 block text-xs uppercase tracking-wider text-slate-500" htmlFor="lang-select">
          Speaking language
        </label>
        <select
          id="lang-select"
          value={settings.language}
          onChange={(e) => onChange({ language: e.target.value as LanguageSetting })}
          className="mb-4 w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-slate-100 outline-none focus:border-accent"
        >
          <option value={AUTO_LANGUAGE}>Auto-detect (recommended)</option>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name} — {l.endonym}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs uppercase tracking-wider text-slate-500" htmlFor="voice-select">
          Voice
        </label>
        <select
          id="voice-select"
          value={settings.voice}
          onChange={(e) => onChange({ voice: e.target.value })}
          className="w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-slate-100 outline-none focus:border-accent"
        >
          <option value="">Default for language</option>
          {voices.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <p className="mt-4 text-xs text-slate-500">
          AUTO means the app detects what you speak and replies in the same language. Pick a specific language to lock it for higher accuracy.
        </p>
      </div>
    </div>
  );
}
