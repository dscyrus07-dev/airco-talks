"use client";
import type { ConnectionStatus as ConnectionState } from "@/lib/websocket-client";
import { ConnectionStatus } from "./ConnectionStatus";
import { ThemeMenu } from "./ThemeMenu";
import type { ConnectionStatus as ConnectionStatusType } from "@/lib/websocket-client";

interface AppHeaderProps {
  connectionStatus: ConnectionStatusType;
  onOpenSettings: () => void;
  onOpenNav: () => void;
}

/**
 * Main content header: brand title (left), connection pill + theme + settings
 * (right). The hamburger appears below lg where the sidebar becomes a drawer.
 */
export function AppHeader({ connectionStatus, onOpenSettings, onOpenNav }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 px-5 py-4 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="glass rounded-lg p-2 text-body transition hover:text-strong lg:hidden"
        >
          <MenuIcon />
        </button>
        <div>
          <h1 className="text-base font-semibold tracking-tight text-strong lg:text-lg">Airco Talks</h1>
          <p className="text-[11px] text-muted">Two-way voice translator</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <ConnectionStatus status={connectionStatus} />
        <ThemeMenu />
        <button
          type="button"
          onClick={onOpenSettings}
          className="glass flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm text-body transition duration-200 hover:border-accent/40 hover:text-strong focus-visible:ring-2 focus-visible:ring-accentSoft/60"
          aria-label="Open settings"
          aria-haspopup="dialog"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-accent to-violet-500 text-xs font-bold text-white" aria-hidden>
            A
          </span>
          Settings
          <ChevronDown />
        </button>
      </div>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
