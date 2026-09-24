"use client";
import type { ConnectionStatus as Status } from "@/lib/websocket-client";

const LABELS: Record<Status, string> = {
  idle: "Not connected",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
};

const DOT: Record<Status, string> = {
  idle: "bg-danger",
  connecting: "bg-warn",
  connected: "bg-ok",
  reconnecting: "bg-warn",
  disconnected: "bg-danger",
};

/** Compact glass status pill with a live status dot. */
export function ConnectionStatus({ status }: { status: Status }) {
  const pulse = status === "reconnecting" || status === "connecting";
  return (
    <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${DOT[status]} ${pulse ? "animate-pulse" : ""}`} aria-hidden />
      <span>{LABELS[status]}</span>
    </div>
  );
}
