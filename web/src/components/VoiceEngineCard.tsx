"use client";
import { useEffect, useState } from "react";

interface Providers {
  "sarvam-stt": boolean;
  "sarvam-tts": boolean;
  cerebras: boolean;
}

type ProviderState = "ready" | "offline" | "unknown";

/**
 * Floating "Voice Engine" status card. Provider readiness comes from the
 * backend's GET /health (real probes, 60s server-side cache) — never
 * hardcoded. While the probe has not answered, rows show "Checking…".
 */
export function VoiceEngineCard() {
  const [providers, setProviders] = useState<Partial<Providers>>({});
  const [reachable, setReachable] = useState<boolean | null>(null);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080";
    const healthUrl = `${wsUrl.replace(/^ws/, "http")}/health`;
    let cancelled = false;

    const probe = () => {
      fetch(healthUrl)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((data: { providers?: Partial<Providers> }) => {
          if (cancelled) return;
          setProviders(data.providers ?? {});
          setReachable(true);
        })
        .catch(() => {
          if (cancelled) return;
          setReachable(false);
        });
    };

    probe();
    const id = setInterval(probe, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const stateOf = (ready?: boolean): ProviderState => {
    if (reachable === false) return "offline";
    if (ready === undefined) return "unknown";
    return ready ? "ready" : "offline";
  };

  return (
    <aside className="glass w-full max-w-xs rounded-2xl p-5 shadow-[0_8px_40px_-12px_rgb(2_6_23/0.9)]" aria-label="Voice engine status">
      <div className="mb-4 flex items-center gap-2">
        <WaveIcon />
        <h2 className="text-sm font-semibold text-strong">Voice Engine</h2>
      </div>

      <ul className="space-y-3.5 text-xs">
        <EngineRow name="Airco STT" state={stateOf(providers["sarvam-stt"])} />
        <EngineRow name="Airco TTS" state={stateOf(providers["sarvam-tts"])} />
        <EngineRow name="Airco LLM" state={stateOf(providers.cerebras)} />
      </ul>

      <div className="mt-5 flex items-center gap-2 rounded-lg border border-line/15 bg-wash/5 px-3 py-2 text-[11px] text-muted">
        <LockIcon />
        Secured &amp; Private
      </div>
    </aside>
  );
}

function EngineRow({ name, state }: { name: string; state: ProviderState }) {
  const dot = state === "ready" ? "bg-ok" : state === "unknown" ? "bg-warn animate-pulse" : "bg-danger";
  const label = state === "ready" ? "Ready" : state === "unknown" ? "Checking…" : "Offline";
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-body">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
        {name}
      </span>
      <span className={`flex items-center gap-1.5 ${state === "ready" ? "text-ok" : state === "unknown" ? "text-warn" : "text-danger"}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        {label}
      </span>
    </li>
  );
}

function WaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(96 165 250)" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 10v4M8 7v10M12 5v14M16 7v10M20 10v4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  );
}
