"use client";
import { useCallback, useState } from "react";
import type { ConversationSide, LanguageCode } from "@airco-talks/shared";

export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  language: LanguageCode;
  /** Conversation side this text belongs to (who spoke it / who hears it). */
  side: ConversationSide;
}

/**
 * Manages the conversation message list + the live partial transcript, kept
 * separate from final messages so partial updates don't re-render history.
 */
export function useConversation() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [aiResponseText, setAiResponseText] = useState("");

  const addUserMessage = useCallback(
    (content: string, language: LanguageCode, side: ConversationSide) => {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content, language, side }]);
    },
    [],
  );

  const finalizeAssistant = useCallback(
    (content: string, language: LanguageCode, side: ConversationSide) => {
      setAiResponseText("");
      if (content.trim()) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content, language, side }]);
      }
    },
    [],
  );

  const appendAiChunk = useCallback((chunk: string) => {
    setAiResponseText((prev) => prev + chunk);
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setPartialTranscript("");
    setAiResponseText("");
  }, []);

  return {
    messages,
    partialTranscript,
    setPartialTranscript,
    aiResponseText,
    addUserMessage,
    finalizeAssistant,
    appendAiChunk,
    clear,
  };
}
