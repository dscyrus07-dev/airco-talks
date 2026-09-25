"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  VoiceSessionState,
  isLanguageCode,
  isLanguageSetting,
  type ConversationSide,
  type LanguageCode,
  type LanguageSetting,
  type ServerMessage,
} from "@airco-talks/shared";
import { useWebSocket } from "./useWebSocket";
import { useMicrophone } from "./useMicrophone";
import { useAudioPlayback } from "./useAudioPlayback";
import { useConversation } from "./useConversation";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080";
const BARGE_IN_LEVEL = 0.15;
const BARGE_IN_CONSECUTIVE = 3;
const SETTINGS_KEY = "airco-talks.settings";

export interface TranslatorSettings {
  /** Language of the person holding the device (always a fixed code). */
  myLanguage: LanguageCode;
  /** Language of the other person — a fixed code or "auto" (customer mode). */
  theirLanguage: LanguageSetting;
  /** Preferred TTS voice override (empty = provider default for language). */
  voice: string;
}

export interface VoiceSessionViewModel {
  voiceState: VoiceSessionState;
  connectionStatus: ReturnType<typeof useWebSocket>["status"];
  detectedLanguage: LanguageCode | null;
  languageConfidence: number;
  partialTranscript: string;
  /** Side of the person currently speaking (live caption panel). */
  partialSide: ConversationSide;
  aiResponseText: string;
  /** Side that hears the translation currently streaming in. */
  aiSide: ConversationSide;
  messages: ReturnType<typeof useConversation>["messages"];
  latency: { speechEndToFirstAudioMs?: number; llmFirstTokenMs?: number; ttsFirstAudioMs?: number };
  error: { code: string; message: string } | null;
  micActive: boolean;
  speaking: boolean;
  getMicLevel: () => number;
  settings: TranslatorSettings;
}

function parseSettings(raw: string | null): TranslatorSettings | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TranslatorSettings>;
    if (!isLanguageCode(parsed.myLanguage)) return null;
    if (!isLanguageSetting(parsed.theirLanguage)) return null;
    return {
      myLanguage: parsed.myLanguage,
      theirLanguage: parsed.theirLanguage,
      voice: typeof parsed.voice === "string" ? parsed.voice : "",
    };
  } catch {
    return null;
  }
}

/**
 * Default pair: the holder picks their language; the customer's language is
 * auto-detected. Loaded from localStorage AFTER mount (never during render)
 * so server-rendered HTML always matches the first client render.
 */
const DEFAULT_SETTINGS: TranslatorSettings = { myLanguage: "hi", theirLanguage: "auto", voice: "" };

export function useVoiceSession() {
  const ws = useWebSocket(WS_URL);
  const mic = useMicrophone();
  const audio = useAudioPlayback();
  const conv = useConversation();

  const [voiceState, setVoiceState] = useState<VoiceSessionState>(VoiceSessionState.IDLE);
  const [detectedLanguage, setDetectedLanguage] = useState<LanguageCode | null>(null);
  const [languageConfidence, setLanguageConfidence] = useState(0);
  const [latency, setLatency] = useState<VoiceSessionViewModel["latency"]>({});
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [settings, setSettings] = useState<TranslatorSettings>(DEFAULT_SETTINGS);
  /** Side of the person currently speaking (drives the live caption panel). */
  const [partialSide, setPartialSide] = useState<ConversationSide>("my");
  /** Side that hears the translation currently streaming in. */
  const [aiSide, setAiSide] = useState<ConversationSide>("my");

  // Hydration-safe settings restore: only after mount, so the first client
  // render matches the server-rendered HTML.
  useEffect(() => {
    try {
      const saved = parseSettings(localStorage.getItem(SETTINGS_KEY));
      if (saved) setSettings(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const sessionIdRef = useRef<string | null>(null);
  const pendingStartRef = useRef<{ sessionId: string; settings: TranslatorSettings } | null>(null);
  const bargeCounterRef = useRef(0);

  // ── Incoming message handling ─────────────────────────────
  useEffect(() => {
    const unsub = ws.subscribe((msg: ServerMessage) => handleServerMessage(msg));
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.status]);

  const handleServerMessage = useCallback(
    (msg: ServerMessage) => {
      // Ignore messages not for the active session (stale events).
      if ("sessionId" in msg && sessionIdRef.current && msg.sessionId !== sessionIdRef.current) return;

      switch (msg.type) {
        case "session_started":
          setVoiceState(VoiceSessionState.LISTENING);
          setError(null);
          break;
        case "state_changed":
          setVoiceState(msg.state as VoiceSessionState);
          break;
        case "transcript_partial":
          conv.setPartialTranscript(msg.text);
          setPartialSide(msg.side);
          break;
        case "transcript_final":
          conv.setPartialTranscript("");
          setPartialSide(msg.side);
          if (msg.text.trim()) conv.addUserMessage(msg.text, msg.language, msg.side);
          break;
        case "language_detected":
          setDetectedLanguage(msg.language);
          setLanguageConfidence(msg.confidence);
          break;
        case "ai_response_started":
          conv.setPartialTranscript("");
          setAiSide(msg.side);
          break;
        case "ai_response_chunk":
          conv.appendAiChunk(msg.text);
          break;
        case "ai_response_completed":
          conv.finalizeAssistant(msg.text, msg.language, msg.side);
          break;
        case "audio_chunk":
          audio.playChunk(msg.data, msg.sampleRate);
          break;
        case "ai_speech_ended":
          // Playback stop is handled by the AudioPlayer's onEnded.
          break;
        case "latency":
          setLatency({
            speechEndToFirstAudioMs: msg.speechEndToFirstAudioMs,
            llmFirstTokenMs: msg.llmFirstTokenMs,
            ttsFirstAudioMs: msg.ttsFirstAudioMs,
          });
          break;
        case "error":
          setError({ code: msg.code, message: msg.message });
          if (!msg.recoverable) setVoiceState(VoiceSessionState.ERROR);
          break;
      }
    },
    [conv, audio],
  );

  // ── Start once the socket is connected ────────────────────
  useEffect(() => {
    if (ws.status !== "connected" || !pendingStartRef.current) return;
    const { sessionId, settings } = pendingStartRef.current;
    pendingStartRef.current = null;
    sessionIdRef.current = sessionId;
    setVoiceState(VoiceSessionState.CONNECTING);

    void mic.start((base64Pcm) => {
      if (sessionIdRef.current) {
        ws.send({ type: "audio_chunk", sessionId: sessionIdRef.current, data: base64Pcm });
      }
    });

    ws.send({
      type: "start_session",
      sessionId,
      myLanguage: settings.myLanguage,
      theirLanguage: settings.theirLanguage,
      voice: settings.voice,
    });
  }, [ws.status, ws, mic]);

  // ── Barge-in: detect speech while the translation is playing ──
  useEffect(() => {
    if (voiceState !== VoiceSessionState.AI_SPEAKING) {
      bargeCounterRef.current = 0;
      return;
    }
    const id = setInterval(() => {
      const level = mic.getLevel();
      if (level > BARGE_IN_LEVEL) {
        bargeCounterRef.current++;
        if (bargeCounterRef.current >= BARGE_IN_CONSECUTIVE) {
          bargeCounterRef.current = 0;
          interrupt();
        }
      } else {
        bargeCounterRef.current = 0;
      }
    }, 80);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceState]);

  // ── Public actions ────────────────────────────────────────
  const start = useCallback(() => {
    setError(null);
    const sessionId = crypto.randomUUID();
    pendingStartRef.current = { sessionId, settings };
    ws.connect();
  }, [settings, ws]);

  const stop = useCallback(() => {
    const sid = sessionIdRef.current;
    if (sid) ws.send({ type: "stop_session", sessionId: sid });
    mic.stop();
    audio.stop();
    sessionIdRef.current = null;
    pendingStartRef.current = null;
    setVoiceState(VoiceSessionState.IDLE);
    conv.setPartialTranscript("");
    ws.disconnect();
  }, [ws, mic, audio, conv]);

  const toggle = useCallback(() => {
    if (voiceState === VoiceSessionState.IDLE || voiceState === VoiceSessionState.ERROR) {
      if (voiceState === VoiceSessionState.ERROR) {
        setVoiceState(VoiceSessionState.IDLE);
        setError(null);
      }
      start();
    } else {
      stop();
    }
  }, [voiceState, start, stop]);

  const interrupt = useCallback(() => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    audio.stop();
    ws.send({ type: "interrupt", sessionId: sid });
    conv.setPartialTranscript("");
  }, [audio, ws, conv]);

  const updateSettings = useCallback(
    (next: Partial<TranslatorSettings>) => {
      setSettings((prev) => {
        const merged = { ...prev, ...next };
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
        } catch {
          /* storage unavailable (private mode) */
        }
        const sid = sessionIdRef.current;
        if (sid) {
          ws.send({
            type: "update_config",
            sessionId: sid,
            myLanguage: merged.myLanguage,
            theirLanguage: merged.theirLanguage,
            voice: merged.voice,
          });
        }
        return merged;
      });
    },
    [ws],
  );

  const clearConversation = useCallback(() => {
    conv.clear();
    setDetectedLanguage(null);
    setLatency({});
    setPartialSide("my");
    setAiSide("my");
  }, [conv]);

  return {
    voiceState,
    connectionStatus: ws.status,
    detectedLanguage,
    languageConfidence,
    partialTranscript: conv.partialTranscript,
    partialSide,
    aiResponseText: conv.aiResponseText,
    aiSide,
    messages: conv.messages,
    latency,
    error,
    micError: mic.error,
    micActive: mic.active,
    speaking: audio.speaking,
    getMicLevel: mic.getLevel,
    settings,
    toggle,
    interrupt,
    updateSettings,
    clearConversation,
  };
}
