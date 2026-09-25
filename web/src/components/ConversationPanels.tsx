"use client";
import { useEffect, useRef } from "react";
import { VoiceSessionState, getLanguage, type ConversationSide } from "@airco-talks/shared";
import type { UIMessage } from "@/hooks/useConversation";

interface ConversationPanelsProps {
  voiceState: VoiceSessionState;
  onMicClick: () => void;
  messages: UIMessage[];
  /** Endonym of the device holder's language. */
  myLanguageEndonym: string;
  /** Label for the customer's language (endonym or "Auto-detect"). */
  theirLanguageLabel: string;
  partial: string;
  partialSide: ConversationSide;
  aiText: string;
  aiSide: ConversationSide;
  /** Panel to highlight right now (who is speaking / who is being translated for). */
  activeSide: ConversationSide | null;
  onClear: () => void;
}

/**
 * Two-panel conversation view: one window per person (You / Customer), each
 * with its own mic. Every message is routed to the side it belongs to —
 * spoken text to the speaker's panel, translations to the listener's panel —
 * so both people can see at a glance who said what and in which language.
 */
export function ConversationPanels({
  voiceState,
  onMicClick,
  messages,
  myLanguageEndonym,
  theirLanguageLabel,
  partial,
  partialSide,
  aiText,
  aiSide,
  activeSide,
  onClear,
}: ConversationPanelsProps) {
  const myMessages = messages.filter((m) => m.side === "my");
  const theirMessages = messages.filter((m) => m.side === "their");
  const hasMessages = messages.length > 0;

  return (
    <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-4 lg:grid-cols-2" aria-label="Translation conversation">
      <ConversationPanel
        side="my"
        title="You"
        languageLabel={myLanguageEndonym}
        messages={myMessages}
        liveText={partialSide === "my" ? partial : aiSide === "my" ? aiText : ""}
        liveKind={partialSide === "my" && partial ? "spoken" : aiSide === "my" && aiText ? "translation" : null}
        active={activeSide === "my"}
        voiceState={voiceState}
        onMicClick={onMicClick}
        emptyHint="Tap your mic and speak"
      />
      <ConversationPanel
        side="their"
        title="Customer"
        languageLabel={theirLanguageLabel}
        messages={theirMessages}
        liveText={partialSide === "their" ? partial : aiSide === "their" ? aiText : ""}
        liveKind={partialSide === "their" && partial ? "spoken" : aiSide === "their" && aiText ? "translation" : null}
        active={activeSide === "their"}
        voiceState={voiceState}
        onMicClick={onMicClick}
        emptyHint="Their speech appears here"
      />
      {hasMessages ? (
        <div className="flex justify-center lg:col-span-2">
          <button
            type="button"
            onClick={onClear}
            className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-wash/10 hover:text-body"
          >
            Clear conversation
          </button>
        </div>
      ) : null}
    </section>
  );
}

interface PanelProps {
  side: ConversationSide;
  title: string;
  languageLabel: string;
  messages: UIMessage[];
  liveText: string;
  liveKind: "spoken" | "translation" | null;
  active: boolean;
  voiceState: VoiceSessionState;
  onMicClick: () => void;
  emptyHint: string;
}

function ConversationPanel({
  title,
  languageLabel,
  messages,
  liveText,
  liveKind,
  active,
  voiceState,
  onMicClick,
  emptyHint,
}: PanelProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the latest message in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, liveText]);

  return (
    <div
      className={`glass flex min-h-[300px] flex-col rounded-2xl p-4 transition duration-200 lg:min-h-[380px] ${
        active ? "ring-2 ring-accent/50 shadow-[0_0_44px_-14px_rgb(var(--accent-rgb)/0.55)]" : ""
      }`}
      aria-label={`${title} panel`}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-strong">
            {active ? <span className="h-2 w-2 rounded-full bg-danger animate-pulse" aria-hidden /> : null}
            {title}
          </p>
          <p className="truncate text-[11px] text-muted">{languageLabel}</p>
        </div>
        <PanelMic state={voiceState} onClick={onMicClick} sideLabel={title} />
      </header>

      {messages.length === 0 && !liveText ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center">
          <p className="text-xs text-faint">{emptyHint}</p>
        </div>
      ) : (
        <ul ref={listRef} className="scroll-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
          {messages.map((m) => (
            <PanelBubble key={m.id} message={m} />
          ))}
        </ul>
      )}

      {liveText ? (
        <p className={`mt-3 text-sm leading-relaxed ${liveKind === "spoken" ? "text-body" : "text-accentSoft"}`} aria-live="polite">
          <span className="text-muted">{liveKind === "spoken" ? "Spoken: " : "Translation: "}</span>
          {liveText}
        </p>
      ) : null}
    </div>
  );
}

function PanelBubble({ message }: { message: UIMessage }) {
  const spoken = message.role === "user";
  const lang = getLanguage(message.language);
  return (
    <li className={`flex ${spoken ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
          spoken ? "bg-accent/20 text-strong" : "bg-wash/10 text-body"
        }`}
      >
        <p>{message.content}</p>
        <p className="mt-1 text-[10px] text-muted">
          {spoken ? "Spoken" : "Translation"} · {lang.endonym}
        </p>
      </div>
    </li>
  );
}

interface PanelMicProps {
  state: VoiceSessionState;
  onClick: () => void;
  sideLabel: string;
}

/**
 * Compact per-panel mic orb. Both mics control the same shared device
 * microphone session: tap to start listening, tap again to stop.
 */
function PanelMic({ state, onClick, sideLabel }: PanelMicProps) {
  const isActive =
    state === VoiceSessionState.LISTENING ||
    state === VoiceSessionState.USER_SPEAKING ||
    state === VoiceSessionState.USER_INTERRUPT;
  const isSpeaking = state === VoiceSessionState.AI_SPEAKING;
  const isBusy = state === VoiceSessionState.PROCESSING || state === VoiceSessionState.CONNECTING;
  const label = isActive ? `Stop listening (${sideLabel})` : `Tap to speak (${sideLabel})`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
      className={`group relative grid h-14 w-14 shrink-0 place-items-center rounded-full border transition duration-200 focus-visible:ring-2 focus-visible:ring-accentSoft/60 ${
        isSpeaking
          ? "border-accent/50 bg-accent/20 text-accentSoft"
          : isActive
            ? "border-danger/50 bg-danger/15 text-danger"
            : "border-line/20 bg-wash/5 text-muted hover:border-accent/40 hover:text-strong"
      }`}
    >
      {isActive ? <span className="absolute inset-0 rounded-full bg-danger/20 animate-pulseRing" aria-hidden /> : null}
      {isBusy ? <SpinnerIcon /> : <MicIcon />}
    </button>
  );
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
