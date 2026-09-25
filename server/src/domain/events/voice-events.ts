import type { ConversationSide, LanguageCode } from "@airco-talks/shared";
import type { VoiceSessionState } from "@airco-talks/shared";

/** Discriminated map of all internal voice-pipeline events (typed payloads). */
export interface VoiceEventMap {
  voice_session_started: { sessionId: string };
  voice_session_ended: { sessionId: string };
  state_changed: { sessionId: string; from: VoiceSessionState; to: VoiceSessionState };
  transcript_partial: { sessionId: string; text: string; language: LanguageCode; side: ConversationSide };
  transcript_final: { sessionId: string; text: string; language: LanguageCode; confidence: number; side: ConversationSide };
  language_detected: { sessionId: string; language: LanguageCode; confidence: number };
  user_turn_completed: { sessionId: string; text: string; language: LanguageCode };
  ai_response_started: { sessionId: string; side: ConversationSide };
  ai_response_chunk: { sessionId: string; text: string };
  ai_response_completed: { sessionId: string; text: string; language: LanguageCode; side: ConversationSide };
  tts_started: { sessionId: string };
  tts_chunk: { sessionId: string; data: string; sampleRate: number };
  tts_completed: { sessionId: string };
  ai_speech_ended: { sessionId: string };
  barge_in: { sessionId: string };
  turn_changed: { sessionId: string; turn: ConversationSide | null };
  provider_error: { sessionId: string; code: string; message: string; recoverable: boolean; provider?: string };
  latency: {
    sessionId: string;
    llmFirstTokenMs?: number;
    ttsFirstAudioMs?: number;
    speechEndToFirstAudioMs?: number;
  };
}

export type VoiceEventName = keyof VoiceEventMap;
export type VoiceEventPayload<E extends VoiceEventName> = VoiceEventMap[E];
export type VoiceEventHandler<E extends VoiceEventName> = (payload: VoiceEventPayload<E>) => void;
