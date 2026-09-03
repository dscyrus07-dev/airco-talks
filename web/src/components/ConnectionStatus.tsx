"use client";

type Status = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

const LABELS: Record<Status, string> = {
  idle: "Not connected",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
};

const COLORS: Record<Status, string> = {
  idle: "bg-slate-500",
  connecting: "bg-amber-400",
  connected: "bg-ok",
  reconnecting: "bg-amber-400",
  disconnected: "bg-danger",
};

export function ConnectionStatus({ status }: { status: Status }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${COLORS[status]} ${status === "reconnecting" || status === "connecting" ? "animate-pulse" : ""}`} />
      <span>{LABELS[status]}</span>
    </div>
  );
}
