"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";
export type AccentName = "royal" | "indigo" | "emerald" | "violet" | "saffron";

export const ACCENTS: readonly { name: AccentName; label: string; swatch: string }[] = [
  { name: "royal", label: "Royal Blue", swatch: "#2563eb" },
  { name: "indigo", label: "Indigo", swatch: "#6366f1" },
  { name: "emerald", label: "Emerald", swatch: "#10b981" },
  { name: "violet", label: "Violet", swatch: "#8b5cf6" },
  { name: "saffron", label: "Saffron", swatch: "#ea8a1e" },
];

const MODE_KEY = "airco-talks.mode";
const ACCENT_KEY = "airco-talks.accent";

const ACCENT_NAMES = ACCENTS.map((a) => a.name);

function toAccentName(value: string | null): AccentName | null {
  return (ACCENT_NAMES as readonly string[]).includes(value ?? "") ? (value as AccentName) : null;
}

function toMode(value: string | null): ThemeMode | null {
  return value === "light" || value === "dark" ? value : null;
}

interface ThemeContextValue {
  mode: ThemeMode;
  accent: AccentName;
  toggleMode: () => void;
  setAccent: (accent: AccentName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Light/dark mode + accent palette provider. Persists to localStorage and
 * mirrors the values onto <html data-mode data-accent> so the CSS variable
 * tokens in globals.css switch instantly. A tiny inline script in layout.tsx
 * applies the saved theme before hydration to prevent a flash.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [accent, setAccentState] = useState<AccentName>("royal");

  useEffect(() => {
    const savedMode = toMode(localStorage.getItem(MODE_KEY));
    const savedAccent = toAccentName(localStorage.getItem(ACCENT_KEY));
    if (savedMode) setMode(savedMode);
    else if (window.matchMedia("(prefers-color-scheme: light)").matches) setMode("light");
    if (savedAccent) setAccentState(savedAccent);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      /* storage unavailable (private mode) */
    }
  }, [mode]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    try {
      localStorage.setItem(ACCENT_KEY, accent);
    } catch {
      /* storage unavailable */
    }
  }, [accent]);

  const toggleMode = useCallback(() => setMode((m) => (m === "dark" ? "light" : "dark")), []);
  const setAccent = useCallback((a: AccentName) => setAccentState(a), []);

  return <ThemeContext.Provider value={{ mode, accent, toggleMode, setAccent }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
