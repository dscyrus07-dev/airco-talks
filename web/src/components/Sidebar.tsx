"use client";
import { ThemeMenu } from "./ThemeMenu";

interface SidebarProps {
  /** Drawer open state on < lg screens. */
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onConnect: () => void;
  connected: boolean;
}

const NAV_ITEMS = [
  { label: "Home", icon: HomeIcon, action: "home" as const },
  { label: "Conversations", icon: ChatIcon, action: "conversations" as const },
  { label: "History", icon: HistoryIcon, action: "history" as const },
  { label: "Bookmarks", icon: BookmarkIcon, action: "soon" as const },
  { label: "Integrations", icon: GridIcon, action: "soon" as const },
  { label: "Settings", icon: GearIcon, action: "settings" as const },
];

/**
 * Premium vertical navigation. Fixed 240px on desktop, slide-over drawer on
 * mobile. "Connect Now" reuses the real session start (opens the WebSocket).
 */
export function Sidebar({ open, onClose, onOpenSettings, onConnect, connected }: SidebarProps) {
  return (
    <>
      {/* Mobile scrim */}
      <div
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line/15 bg-sidebar/95 backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 lg:bg-sidebar/70 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Primary navigation"
      >
        <Brand />
        <Navigation onNavigate={(action) => {
          if (action === "settings") onOpenSettings();
          if (action === "home" || action === "conversations") onClose();
        }} />
        <div className="mt-auto flex flex-col gap-4 p-4">
          <UnlockCard connected={connected} onConnect={onConnect} />
          <ThemeRow />
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 border-b border-line/10 px-5 py-5">
      <img
        src="/airco-talks-logo.png"
        alt="Airco Talks logo"
        className="h-11 w-auto rounded-lg bg-white px-2 py-1 object-contain shadow-sm"
      />
    </div>
  );
}

function Navigation({ onNavigate }: { onNavigate: (action: "home" | "conversations" | "settings") => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Main">
      {NAV_ITEMS.map(({ label, icon: Icon, action }, idx) => {
        const active = idx === 0;
        const disabled = action === "soon";
        return (
          <button
            key={label}
            type="button"
            aria-current={active ? "page" : undefined}
            aria-disabled={disabled || undefined}
            title={disabled ? "Coming soon" : undefined}
            onClick={() => {
              if (disabled) return;
              if (action === "home") onNavigate("home");
              else if (action === "conversations") onNavigate("conversations");
              else if (action === "settings") onNavigate("settings");
            }}
            className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition duration-200 ${
              active
                ? "bg-accent/15 text-strong shadow-[inset_0_0_20px_rgb(var(--accent-rgb)/0.12)] ring-1 ring-accent/30"
                : disabled
                  ? "text-faint"
                  : "text-muted hover:bg-wash/5 hover:text-body"
            }`}
          >
            <span className={`grid h-5 w-5 place-items-center ${active ? "text-accentSoft" : ""}`}>
              <Icon />
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function UnlockCard({ connected, onConnect }: { connected: boolean; onConnect: () => void }) {
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-4">
      <div className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-violet-500/20 blur-2xl" aria-hidden />
      <div className="mb-2 flex items-center gap-2">
        <SparkleIcon />
        <p className="text-sm font-semibold text-strong">Unlock More</p>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted">
        Connect to start translating conversations live.
      </p>
      <button
        type="button"
        onClick={onConnect}
        disabled={connected}
        className={`w-full rounded-lg px-3 py-2 text-xs font-semibold text-white transition duration-200 ${
          connected
            ? "cursor-default bg-ok/20 text-ok ring-1 ring-ok/40"
            : "bg-gradient-to-r from-accent to-violet-500 shadow-[0_0_24px_-6px_rgb(var(--accent-rgb)/0.7)] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-accentSoft"
        }`}
      >
        {connected ? "Connected" : "Connect Now"}
      </button>
    </div>
  );
}

function ThemeRow() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line/10 bg-wash/5 px-3.5 py-2">
      <span className="flex items-center gap-2 text-xs text-muted">
        <MoonIcon />
        Theme
      </span>
      <ThemeMenu compact />
    </div>
  );
}

// ── Icons (inline, consistent 1.5px stroke) ─────────────────

function HomeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 0 1-8 8H4l2.5-2.5A8 8 0 1 1 21 12z" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 4h12v17l-6-4-6 4z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="14" y="4" width="6" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6" height="6.5" rx="1.5" />
      <rect x="4" y="4" width="6" height="6.5" rx="1.5" />
      <rect x="14" y="13.5" width="6" height="6.5" rx="1.5" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9z" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.9 5.6L19.5 9l-5.6 1.4L12 16l-1.9-5.6L4.5 9l5.6-1.4L12 2z" opacity="0.9" />
      <path d="M19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14z" opacity="0.7" />
    </svg>
  );
}
