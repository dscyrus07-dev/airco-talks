import type { ConversationSide, LanguageCode, LanguageSetting } from "@airco-talks/shared";
import { VoiceSessionState } from "@airco-talks/shared";

import { EventBus } from "../domain/event-bus.js";
import { VoiceSessionStateMachine } from "../domain/state-machine/voice-session-state-machine.js";
import type { ILogger } from "../domain/interfaces/logger.js";
import type {
  SpeechRecognitionProvider,
  AudioChunk,
  ProviderErrorEvent,
} from "../domain/interfaces/speech-recognition-provider.js";
import type { LLMProvider } from "../domain/interfaces/llm-provider.js";
import type { TTSProvider } from "../domain/interfaces/tts-provider.js";

import { ConversationManager } from "./conversation-manager.js";
import { LanguageService } from "./language-service.js";
import { buildTranslationPrompt } from "./prompt-builder.js";

export interface OrchestratorConfig {
  confidenceThreshold: number;
  maxContextMessages: number;
  sampleRate: number;
}

export interface OrchestratorDeps {
  speechProvider: SpeechRecognitionProvider;
  llmProvider: LLMProvider;
  ttsProvider: TTSProvider;
  conversationManager: ConversationManager;
  languageService: LanguageService;
  eventBus: EventBus;
  logger: ILogger;
  config: OrchestratorConfig;
}

interface SessionRuntime {
  sessionId: string;
  stateMachine: VoiceSessionStateMachine;
  myLanguage: LanguageCode;
  /** The other person's language — fixed code or "auto" (customer mode). */
  theirLanguage: LanguageSetting;
  /** The customer's last heard language (used when theirLanguage is "auto"). */
  lastCustomerLanguage?: LanguageCode;
  voice?: string;
  /** Aborts the current LLM + TTS generation (barge-in / stop). */
  generationAbort?: AbortController;
  /** Timestamps for latency tracking. */
  speechEndTs?: number;
  llmFirstTokenTs?: number;
  ttsFirstAudioTs?: number;
  /** Accumulated translation text for the current turn. */
  assistantText: string;
  /** Whether a TTS sentence is currently streaming (used to order audio). */
  ttsBusy: boolean;
  /** Queued sentences waiting for TTS. */
  ttsQueue: string[];
  /** Whether the LLM has finished producing text. */
  llmDone: boolean;
  /** Marks the first-audio latency already recorded for this turn. */
  firstAudioRecorded: boolean;
  active: boolean;
}

/** Split text into sentence-sized chunks at sentence boundaries (incl. Devanagari danda). */
const SENTENCE_BOUNDARY = /([.!?।]+["')\]?\s]*)/;

/**
 * Two-way voice translator orchestrator.
 *
 * One device sits between two speakers. STT runs with native auto language
 * detection; every final transcript is translated into the OTHER language of
 * the session's pair, then spoken aloud via TTS in that language.
 */
export class VoiceConversationOrchestrator {
  private readonly sessions = new Map<string, SessionRuntime>();

  constructor(private readonly deps: OrchestratorDeps) {}

  async startSession(
    sessionId: string,
    myLanguage: LanguageCode,
    theirLanguage: LanguageSetting,
    voice?: string,
  ): Promise<void> {
    if (this.sessions.has(sessionId)) {
      this.deps.logger.warn("startSession called for active session", { sessionId });
      return;
    }
    const conv = this.deps.conversationManager.create(sessionId, myLanguage, theirLanguage);
    // Two people take turns speaking, so STT always runs with Sarvam's native
    // auto-detection (language_code=auto) — each utterance is detected live.
    const sttLanguage = "auto" as const;

    const runtime: SessionRuntime = {
      sessionId,
      stateMachine: new VoiceSessionStateMachine(),
      myLanguage,
      theirLanguage,
      voice,
      assistantText: "",
      ttsBusy: false,
      ttsQueue: [],
      llmDone: false,
      firstAudioRecorded: false,
      active: true,
    };
    this.sessions.set(sessionId, runtime);

    this.transition(runtime, VoiceSessionState.CONNECTING);
    this.deps.eventBus.emit("voice_session_started", { sessionId });

    try {
      await this.deps.speechProvider.startSession({
        language: sttLanguage,
        sampleRate: this.deps.config.sampleRate,
        signal: new AbortController().signal,
        handlers: {
          onPartialTranscript: (e) => this.onPartial(runtime, e),
          onFinalTranscript: (e) => this.onFinal(runtime, e),
          onSpeechStart: () => this.onSpeechStart(runtime),
          onSpeechEnd: () => this.onSpeechEnd(runtime),
          onError: (e) => this.onProviderError(runtime, e, "stt"),
          onConnectionStateChange: (s) =>
            this.deps.logger.debug("stt connection state", { sessionId, state: s }),
        },
      });
      this.transition(runtime, VoiceSessionState.LISTENING);
    } catch (err) {
      this.onProviderError(
        runtime,
        this.toProviderError(err, "stt", "STT_START_FAILED"),
        "stt",
      );
    }
  }

  async handleAudioChunk(sessionId: string, data: Uint8Array): Promise<void> {
    const runtime = this.sessions.get(sessionId);
    if (!runtime || !runtime.active) return;
    const chunk: AudioChunk = { data, sampleRate: this.deps.config.sampleRate };
    try {
      await this.deps.speechProvider.sendAudio(chunk);
    } catch (err) {
      this.deps.logger.warn("sendAudio failed", { sessionId, err: String(err) });
    }
  }

  /** Barge-in: someone started speaking while the translation was playing. */
  async interrupt(sessionId: string): Promise<void> {
    const runtime = this.sessions.get(sessionId);
    if (!runtime || !runtime.active) return;
    if (runtime.stateMachine.state !== VoiceSessionState.AI_SPEAKING) return;

    this.deps.eventBus.emit("barge_in", { sessionId });
    this.deps.logger.info("barge-in", { sessionId });
    this.cancelGeneration(runtime);
    // Reset turn accumulators.
    runtime.ttsQueue.length = 0;
    runtime.assistantText = "";
    runtime.llmDone = false;
    runtime.firstAudioRecorded = false;
    this.deps.eventBus.emit("ai_speech_ended", { sessionId });
    this.transition(runtime, VoiceSessionState.LISTENING);
  }

  async updateConfig(
    sessionId: string,
    myLanguage?: LanguageCode,
    theirLanguage?: LanguageSetting,
    voice?: string,
  ): Promise<void> {
    const runtime = this.sessions.get(sessionId);
    if (!runtime) return;
    const conv = this.deps.conversationManager.get(sessionId);
    if (
      (myLanguage && theirLanguage) &&
      (myLanguage !== runtime.myLanguage || theirLanguage !== runtime.theirLanguage)
    ) {
      runtime.myLanguage = myLanguage;
      runtime.theirLanguage = theirLanguage;
      runtime.lastCustomerLanguage = undefined;
      conv?.setLanguagePair(myLanguage, theirLanguage);
    }
    if (voice !== undefined) runtime.voice = voice;
  }

  async stopSession(sessionId: string): Promise<void> {
    const runtime = this.sessions.get(sessionId);
    if (!runtime) return;
    runtime.active = false;
    this.cancelGeneration(runtime);
    try {
      await this.deps.speechProvider.stopSession();
    } catch (err) {
      this.deps.logger.warn("stopSession provider error", { sessionId, err: String(err) });
    }
    this.transition(runtime, VoiceSessionState.ENDED);
    this.deps.eventBus.emit("voice_session_ended", { sessionId });
    this.deps.conversationManager.remove(sessionId);
    this.sessions.delete(sessionId);
  }

  // ── STT handlers ──────────────────────────────────────────

  private onPartial(runtime: SessionRuntime, e: { text: string; language: LanguageCode }): void {
    if (!runtime.active) return;
    if (runtime.stateMachine.state === VoiceSessionState.LISTENING) {
      this.transition(runtime, VoiceSessionState.USER_SPEAKING);
    }
    this.deps.eventBus.emit("transcript_partial", {
      sessionId: runtime.sessionId,
      text: e.text,
      language: e.language,
      side: this.deps.languageService.resolveSpeakerSide(e.language, runtime.myLanguage, runtime.theirLanguage),
    });
  }

  private onSpeechStart(runtime: SessionRuntime): void {
    if (!runtime.active) return;
    if (runtime.stateMachine.state === VoiceSessionState.LISTENING) {
      this.transition(runtime, VoiceSessionState.USER_SPEAKING);
    }
  }

  private onSpeechEnd(runtime: SessionRuntime): void {
    if (!runtime.active) return;
    if (runtime.stateMachine.state === VoiceSessionState.USER_SPEAKING ||
        runtime.stateMachine.state === VoiceSessionState.LISTENING) {
      this.transition(runtime, VoiceSessionState.PROCESSING);
      runtime.speechEndTs = Date.now();
    }
  }

  private onFinal(runtime: SessionRuntime, e: { text: string; language: LanguageCode; confidence: number }): void {
    if (!runtime.active) return;
    const text = e.text.trim();
    if (!text) {
      // Empty final (noise) — go back to listening if we were processing.
      if (runtime.stateMachine.state === VoiceSessionState.PROCESSING) {
        this.transition(runtime, VoiceSessionState.LISTENING);
      }
      return;
    }

    // Ignore finals that arrive while the translation is being spoken (likely
    // echo) unless a barge-in is in progress. Barge-in transitions to
    // LISTENING first, so the genuine interrupting utterance is processed.
    if (runtime.stateMachine.state === VoiceSessionState.AI_SPEAKING) {
      return;
    }

    // Recover from ERROR: if a previous turn failed but STT is still running,
    // treat the new transcript as a fresh turn.
    if (runtime.stateMachine.state === VoiceSessionState.ERROR) {
      this.transition(runtime, VoiceSessionState.LISTENING);
    }

    const conv = this.deps.conversationManager.get(runtime.sessionId);
    if (!conv) return;

    conv.recordDetection(e.language, e.confidence);
    // The detected language tells us WHO spoke; the translation target follows
    // the direction policy (fixed pair or customer "auto" mode).
    const { target: targetLanguage, speakerSide, newCustomerLanguage } =
      this.deps.languageService.resolveTranslationTarget(
        e.language,
        runtime.myLanguage,
        runtime.theirLanguage,
        runtime.lastCustomerLanguage,
        e.confidence,
        this.deps.config.confidenceThreshold,
      );
    if (newCustomerLanguage) {
      runtime.lastCustomerLanguage = newCustomerLanguage;
      conv.setLastCustomerLanguage(newCustomerLanguage);
    }

    this.deps.eventBus.emit("transcript_final", {
      sessionId: runtime.sessionId,
      text,
      language: e.language,
      confidence: e.confidence,
      side: speakerSide,
    });

    this.deps.eventBus.emit("language_detected", {
      sessionId: runtime.sessionId,
      language: e.language,
      confidence: e.confidence,
    });

    conv.addUserMessage(text, e.language, { confidence: e.confidence });
    this.deps.eventBus.emit("user_turn_completed", {
      sessionId: runtime.sessionId,
      text,
      language: e.language,
    });

    void this.runTranslation(runtime, text, e.language, targetLanguage, speakerSide);
  }

  // ── LLM + TTS streaming pipeline ──────────────────────────

  private async runTranslation(
    runtime: SessionRuntime,
    utterance: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
    speakerSide: ConversationSide,
  ): Promise<void> {
    const conv = this.deps.conversationManager.get(runtime.sessionId);
    if (!conv || !runtime.active) return;

    runtime.generationAbort = new AbortController();
    runtime.assistantText = "";
    runtime.ttsQueue.length = 0;
    runtime.llmDone = false;
    runtime.firstAudioRecorded = false;
    runtime.ttsBusy = false;

    // Transition to PROCESSING if not already there (onSpeechEnd may have done it).
    if (runtime.stateMachine.state !== VoiceSessionState.PROCESSING) {
      this.transition(runtime, VoiceSessionState.PROCESSING);
    }
    // The translation is heard by the side opposite to the speaker.
    const hearerSide: ConversationSide = speakerSide === "my" ? "their" : "my";
    this.deps.eventBus.emit("ai_response_started", { sessionId: runtime.sessionId, side: hearerSide });

    const { messages } = buildTranslationPrompt(utterance, sourceLanguage, targetLanguage);

    let sentenceBuffer = "";

    try {
      await this.deps.llmProvider.streamResponse(
        {
          messages,
          preferredLanguage: targetLanguage,
          signal: runtime.generationAbort.signal,
        },
        {
          onFirstToken: () => {
            runtime.llmFirstTokenTs = Date.now();
            this.emitLatency(runtime);
            this.transition(runtime, VoiceSessionState.AI_SPEAKING);
          },
          onChunk: (chunk) => {
            if (runtime.generationAbort?.signal.aborted) return;
            runtime.assistantText += chunk;
            this.deps.eventBus.emit("ai_response_chunk", { sessionId: runtime.sessionId, text: chunk });
            // Buffer until a sentence boundary, then enqueue the complete
            // sentence(s) for TTS so audio playback can start early.
            sentenceBuffer += chunk;
            const parts = sentenceBuffer.split(SENTENCE_BOUNDARY);
            if (parts.length <= 1) return; // no boundary yet
            const remainder = parts[parts.length - 1] ?? "";
            const complete = parts.slice(0, -1).join("");
            sentenceBuffer = remainder;
            if (complete.trim()) {
              runtime.ttsQueue.push(complete.trim());
              void this.drainTtsQueue(runtime, targetLanguage, hearerSide);
            }
          },
          onComplete: () => {
            runtime.llmDone = true;
            if (sentenceBuffer.trim()) {
              runtime.ttsQueue.push(sentenceBuffer.trim());
              sentenceBuffer = "";
              void this.drainTtsQueue(runtime, targetLanguage, hearerSide);
            }
          },
          onError: (e) => this.onProviderError(runtime, e, "llm"),
        },
      );
    } catch (err) {
      if (!runtime.generationAbort?.signal.aborted) {
        this.onProviderError(runtime, this.toProviderError(err, "llm", "LLM_FAILED"), "llm");
      }
    }

    // If LLM produced nothing at all, recover gracefully.
    if (!runtime.assistantText.trim() && runtime.active) {
      this.deps.eventBus.emit("ai_response_completed", {
        sessionId: runtime.sessionId,
        text: "",
        language: targetLanguage,
        side: hearerSide,
      });
      this.deps.eventBus.emit("ai_speech_ended", { sessionId: runtime.sessionId });
      this.transition(runtime, VoiceSessionState.LISTENING);
    }
  }

  /** Process queued TTS sentences sequentially to preserve audio order. */
  private async drainTtsQueue(runtime: SessionRuntime, language: LanguageCode, hearerSide: ConversationSide): Promise<void> {
    if (runtime.ttsBusy || !runtime.active) return;
    const next = runtime.ttsQueue.shift();
    if (!next) {
      // Nothing left to synthesize; if LLM is also done, finish the turn.
      if (runtime.llmDone && !runtime.ttsBusy && runtime.ttsQueue.length === 0) {
        this.finishTurn(runtime, language, hearerSide);
      }
      return;
    }
    runtime.ttsBusy = true;
    if (!runtime.firstAudioRecorded) {
      this.deps.eventBus.emit("tts_started", { sessionId: runtime.sessionId });
    }
    try {
      await this.deps.ttsProvider.streamSynthesis(
        {
          text: next,
          language,
          voice: runtime.voice,
          signal: runtime.generationAbort?.signal ?? new AbortController().signal,
        },
        {
          onFirstAudio: () => {
            if (!runtime.firstAudioRecorded) {
              runtime.firstAudioRecorded = true;
              runtime.ttsFirstAudioTs = Date.now();
              this.emitLatency(runtime);
            }
          },
          onChunk: (audioBase64, sampleRate) => {
            this.deps.eventBus.emit("tts_chunk", {
              sessionId: runtime.sessionId,
              data: audioBase64,
              sampleRate,
            });
          },
          onComplete: () => {
            // handled after await below
          },
          onError: (e) => this.onProviderError(runtime, e, "tts"),
        },
      );
    } catch (err) {
      if (!runtime.generationAbort?.signal.aborted) {
        this.onProviderError(runtime, this.toProviderError(err, "tts", "TTS_FAILED"), "tts");
      }
    }
    runtime.ttsBusy = false;
    if (runtime.active && !runtime.generationAbort?.signal.aborted) {
      void this.drainTtsQueue(runtime, language, hearerSide);
    }
  }

  private finishTurn(runtime: SessionRuntime, language: LanguageCode, hearerSide: ConversationSide): void {
    if (!runtime.active) return;
    const conv = this.deps.conversationManager.get(runtime.sessionId);
    const finalText = runtime.assistantText.trim();
    if (conv && finalText) {
      conv.addAssistantMessage(finalText, language, {
        llmFirstTokenMs: runtime.llmFirstTokenTs ? runtime.llmFirstTokenTs - (runtime.speechEndTs ?? runtime.llmFirstTokenTs) : undefined,
        ttsFirstAudioMs: runtime.ttsFirstAudioTs ? runtime.ttsFirstAudioTs - (runtime.speechEndTs ?? runtime.ttsFirstAudioTs) : undefined,
        speechEndToFirstAudioMs:
          runtime.speechEndTs && runtime.ttsFirstAudioTs
            ? runtime.ttsFirstAudioTs - runtime.speechEndTs
            : undefined,
      });
    }
    this.deps.eventBus.emit("ai_response_completed", {
      sessionId: runtime.sessionId,
      text: finalText,
      language,
      side: hearerSide,
    });
    this.deps.eventBus.emit("tts_completed", { sessionId: runtime.sessionId });
    this.deps.eventBus.emit("ai_speech_ended", { sessionId: runtime.sessionId });
    if (runtime.stateMachine.state === VoiceSessionState.AI_SPEAKING) {
      this.transition(runtime, VoiceSessionState.LISTENING);
    }
  }

  // ── helpers ───────────────────────────────────────────────

  private cancelGeneration(runtime: SessionRuntime): void {
    runtime.generationAbort?.abort();
    runtime.generationAbort = undefined;
  }

  private transition(runtime: SessionRuntime, to: VoiceSessionState): void {
    const from = runtime.stateMachine.state;
    if (!runtime.stateMachine.tryTransition(to)) {
      this.deps.logger.warn("rejected state transition", {
        sessionId: runtime.sessionId,
        from,
        to,
      });
      return;
    }
    this.deps.eventBus.emit("state_changed", { sessionId: runtime.sessionId, from, to });
  }

  private emitLatency(runtime: SessionRuntime): void {
    const speechEndToFirstAudioMs =
      runtime.speechEndTs && runtime.ttsFirstAudioTs ? runtime.ttsFirstAudioTs - runtime.speechEndTs : undefined;
    const llmFirstTokenMs = runtime.speechEndTs && runtime.llmFirstTokenTs ? runtime.llmFirstTokenTs - runtime.speechEndTs : undefined;
    const ttsFirstAudioMs = runtime.ttsFirstAudioTs && runtime.speechEndTs ? runtime.ttsFirstAudioTs - runtime.speechEndTs : undefined;
    this.deps.eventBus.emit("latency", {
      sessionId: runtime.sessionId,
      speechEndToFirstAudioMs,
      llmFirstTokenMs,
      ttsFirstAudioMs,
    });
  }

  private onProviderError(runtime: SessionRuntime, e: ProviderErrorEvent, layer: string): void {
    this.deps.logger.error(`provider error [${layer}]`, {
      sessionId: runtime.sessionId,
      code: e.code,
      message: e.message,
      provider: e.provider,
    });
    this.deps.eventBus.emit("provider_error", {
      sessionId: runtime.sessionId,
      code: e.code,
      message: e.message,
      recoverable: e.recoverable,
      provider: e.provider,
    });
    if (runtime.stateMachine.state !== VoiceSessionState.ENDED) {
      this.transition(runtime, VoiceSessionState.ERROR);
    }
  }

  private toProviderError(err: unknown, provider: string, code: string): ProviderErrorEvent {
    // Duck-type rather than instanceof: AppError is imported from a separately
    // compiled package, and instanceof can fail across module duplicates.
    if (err && typeof err === "object" && "code" in err && "message" in err) {
      const e = err as { code: string; message: string; recoverable?: boolean; provider?: string };
      return {
        code: e.code,
        message: e.message,
        recoverable: e.recoverable ?? true,
        provider: e.provider ?? provider,
      };
    }
    return {
      code,
      message: err instanceof Error ? err.message : String(err),
      recoverable: true,
      provider,
    };
  }
}
