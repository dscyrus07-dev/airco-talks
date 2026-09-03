"use client";
import type { UIMessage } from "@/hooks/useConversation";
import { getLanguage } from "@dhvani/shared";

interface Props {
  messages: UIMessage[];
  onClear: () => void;
}

/** Scrollable conversation history (secondary UI element). */
export function ConversationHistory({ messages, onClear }: Props) {
  if (messages.length === 0) return null;
  return (
    <div className="mx-auto w-full max-w-xl px-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wider text-slate-500">Conversation</h2>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md px-2 py-1 text-xs text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
        >
          Clear
        </button>
      </div>
      <ul className="scroll-thin max-h-64 space-y-3 overflow-y-auto pr-1">
        {messages.map((m) => {
          const isUser = m.role === "user";
          const lang = getLanguage(m.language);
          return (
            <li key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                  isUser ? "bg-accent/20 text-slate-100" : "bg-white/5 text-slate-200"
                }`}
              >
                <p>{m.content}</p>
                <p className="mt-1 text-[10px] text-slate-500">{isUser ? "You" : "AI"} · {lang.endonym}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
