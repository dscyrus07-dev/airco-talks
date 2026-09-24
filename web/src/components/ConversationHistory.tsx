"use client";
import { useEffect, useRef } from "react";
import type { UIMessage } from "@/hooks/useConversation";
import { getLanguage } from "@airco-talks/shared";

interface Props {
  messages: UIMessage[];
  onClear: () => void;
  /** Conversation mode: taller, auto-scrolls to the latest message. */
  expanded?: boolean;
}

/** Scrollable translation history (secondary UI element). */
export function ConversationHistory({ messages, onClear, expanded = false }: Props) {
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the latest message in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, expanded]);

  if (messages.length === 0) return null;
  return (
    <div className={`mx-auto w-full px-4 ${expanded ? "max-w-2xl flex-1 min-h-0" : "max-w-xl"}`}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wider text-muted">Translation log</h2>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md px-2 py-1 text-xs text-muted transition hover:bg-wash/10 hover:text-body"
        >
          Clear
        </button>
      </div>
      <ul
        ref={listRef}
        className={`scroll-thin space-y-3 overflow-y-auto pr-1 ${expanded ? "max-h-[52vh]" : "max-h-64"}`}
      >
        {messages.map((m) => {
          const spoken = m.role === "user";
          const lang = getLanguage(m.language);
          return (
            <li key={m.id} className={`flex ${spoken ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                  spoken ? "bg-accent/20 text-strong" : "bg-wash/10 text-body"
                }`}
              >
                <p>{m.content}</p>
                <p className="mt-1 text-[10px] text-muted">
                  {spoken ? "Spoken" : "Translation"} · {lang.endonym}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
