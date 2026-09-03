"use client";
import { useCallback, useState } from "react";
import type { LanguageCode } from "@dhvani/shared";

export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  language: LanguageCode;
}

/**
 * Manages the conversation message list + the live partial transcript, kept
 * separate from final messages so partial updates don't re-render history.
 */
export function useConversation() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [aiResponseText, setAiResponseText] = useState("");

  const addUserMessage = useCallback((content: string, language: LanguageCode) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content, language }]);
  }, []);

  const finalizeAssistant = useCallback((content: string, language: LanguageCode) => {
    setAiResponseText("");
    if (content.trim()) {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content, language }]);
    }
  }, []);

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
