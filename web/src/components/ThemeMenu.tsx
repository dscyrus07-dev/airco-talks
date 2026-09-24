"use client";
import { useEffect, useRef, useState } from "react";
import { ACCENTS, useTheme } from "./ThemeProvider";

/**
 * Header control: light/dark toggle + accent palette popover.
 * Both persist via ThemeProvider and apply instantly via CSS variables.
 * `compact` renders smaller paddings for the sidebar theme row.
 */
export function ThemeMenu({ compact = false }: { compact?: boolean }) {
  const { mode, accent, toggleMode, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const btnPad = compact ? "p-1.5" : "p-2";

  return (
    <div className="relative flex items-center gap-1" ref={rootRef}>
      <button
        type="button"
        onClick={toggleMode}
        aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className={`rounded-md text-body transition hover:bg-wash/10 ${btnPad}`}
      >
        {mode === "dark" ? <SunIcon /> : <MoonIcon />}
      </button>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Change accent color"
        aria-expanded={open}
        className={`rounded-md text-body transition hover:bg-wash/10 ${btnPad}`}
      >
        <PaletteIcon />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 rounded-xl border border-line/10 bg-panel p-3 shadow-2xl" role="menu" aria-label="Accent color">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-muted">Accent</p>
          <div className="flex gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.name}
                type="button"
                title={a.label}
                aria-label={`${a.label} theme`}
                aria-pressed={accent === a.name}
                onClick={() => {
                  setAccent(a.name);
                  setOpen(false);
                }}
                className={`h-7 w-7 rounded-full transition ring-2 ring-offset-2 ring-offset-transparent ${
                  accent === a.name ? "ring-accent scale-110" : "ring-transparent hover:scale-110"
                }`}
                style={{ backgroundColor: a.swatch }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9z" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="8.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="10.5" r="1" stroke="none" fill="currentColor" />
      <path d="M8 15c1.2 1 2.6 1.8 4 1.8s2.9-.6 4-1.8" />
    </svg>
  );
}
