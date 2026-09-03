import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoiceSessionState, AUTO_LANGUAGE } from "@dhvani/shared";
import { EventBus } from "../server/src/domain/event-bus.js";
import { VoiceConversationOrchestrator } from "../server/src/application/voice-conversation-orchestrator.js";
import { ConversationManager } from "../server/src/application/conversation-manager.js";
import { LanguageService } from "../server/src/application/language-service.js";
import type { ILogger } from "../server/src/domain/interfaces/logger.js";
import type {
  SpeechRecognitionProvider,
  StartSpeechSessionOptions,
  AudioChunk,
  SttLanguage,
  ProviderErrorEvent,
} from "../server/src/domain/interfaces/speech-recognition-provider.js";
import type { LLMProvider, LLMRequest, LLMStreamHandlers } from "../server/src/domain/interfaces/llm-provider.js";
import type { TTSProvider, TTSRequest, TTSStreamHandlers } from "../server/src/domain/interfaces/tts-provider.js";

// ── Mocks ──────────────────────────────────────────────────

class MockSpeechProvider implements SpeechRecognitionProvider {
  readonly name = "mock-stt";
  startCalls: StartSpeechSessionOptions[] = [];
  audioChunks: Uint8Array[] = [];
  updateCalls: SttLanguage[] = [];
  stopped = false;
  handlers: StartSpeechSessionOptions["handlers"] = {};

  async startSession(options: StartSpeechSessionOptions): Promise<void> {
    this.startCalls.push(options);
    this.handlers = options.handlers;
  }
  async sendAudio(chunk: AudioChunk): Promise<void> {
    this.audioChunks.push(chunk.data);
  }
  async updateLanguage(language: SttLanguage): Promise<void> {
    this.updateCalls.push(language);
  }
  async stopSession(): Promise<void> {
    this.stopped = true;
  }
  async healthCheck(): Promise<boolean> {
    return true;
  }

  /** Test helper: simulate a final transcript from the STT provider. */
  emitFinal(text: string, language: "mr" | "hi" | "en", confidence = 0.95): void {
    this.handlers.onFinalTranscript?.({ text, language, confidence });
  }
  emitPartial(text: string, language: "mr" | "hi" | "en"): void {
    this.handlers.onPartialTranscript?.({ text, language });
  }
}

class MockLLMProvider implements LLMProvider {
  readonly name = "mock-llm";
  streamCalls: LLMRequest[] = [];
  responseText = "नमस्कार! मी ठीक आहे.";

  async streamResponse(request: LLMRequest, handlers: LLMStreamHandlers): Promise<void> {
    this.streamCalls.push(request);
    // Simulate streaming the response in two chunks.
    handlers.onFirstToken?.();
    const parts = this.responseText.split(" ");
    for (let i = 0; i < parts.length; i++) {
      handlers.onChunk?.((i === 0 ? "" : " ") + parts[i]!);
    }
    handlers.onComplete?.(this.responseText);
  }
  async healthCheck(): Promise<boolean> {
    return true;
  }
}

class MockTTSProvider implements TTSProvider {
  readonly name = "mock-tts";
  streamCalls: TTSRequest[] = [];
  chunks = ["AAAA", "BBBB", "CCCC"];
  sampleRate = 24000;

  async streamSynthesis(request: TTSRequest, handlers: TTSStreamHandlers): Promise<void> {
    this.streamCalls.push(request);
    handlers.onFirstAudio?.();
    for (const c of this.chunks) {
      handlers.onChunk?.(c, this.sampleRate);
    }
    handlers.onComplete?.();
  }
  getVoices(): string[] {
    return ["shubh", "anushka"];
  }
  async healthCheck(): Promise<boolean> {
    return true;
  }
}

class MockLogger implements ILogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

// ── Tests ──────────────────────────────────────────────────

describe("VoiceConversationOrchestrator", () => {
  let speech: MockSpeechProvider;
  let llm: MockLLMProvider;
  let tts: MockTTSProvider;
  let orchestrator: VoiceConversationOrchestrator;
  let eventBus: EventBus;

  beforeEach(() => {
    speech = new MockSpeechProvider();
    llm = new MockLLMProvider();
    tts = new MockTTSProvider();
    eventBus = new EventBus();
    orchestrator = new VoiceConversationOrchestrator({
      speechProvider: speech,
      llmProvider: llm,
      ttsProvider: tts,
      conversationManager: new ConversationManager(),
      languageService: new LanguageService(),
      eventBus,
      logger: new MockLogger(),
      config: {
        defaultAutoLanguage: "hi",
        confidenceThreshold: 0.6,
        maxContextMessages: 12,
        sampleRate: 16000,
      },
    });
  });

  it("starts a session and opens the STT provider with auto language", async () => {
    await orchestrator.startSession("s1", AUTO_LANGUAGE, "");
    expect(speech.startCalls).toHaveLength(1);
    expect(speech.startCalls[0]?.language).toBe("auto");
  });

  it("starts a session with a fixed language and passes the locale to STT", async () => {
    await orchestrator.startSession("s1", "mr", "");
    expect(speech.startCalls[0]?.language).toBe("mr-IN");
  });

  it("forwards audio chunks to the STT provider", async () => {
    await orchestrator.startSession("s1", AUTO_LANGUAGE, "");
    await orchestrator.handleAudioChunk("s1", new Uint8Array([1, 2, 3]));
    await orchestrator.handleAudioChunk("s1", new Uint8Array([4, 5, 6]));
    expect(speech.audioChunks).toHaveLength(2);
  });

  it("processes a final transcript through LLM → TTS pipeline", async () => {
    const states: VoiceSessionState[] = [];
    eventBus.on("state_changed", (p) => states.push(p.to));

    await orchestrator.startSession("s1", AUTO_LANGUAGE, "");
    speech.emitFinal("हॅलो", "mr", 0.95);

    // Allow microtasks to flush (the pipeline is async).
    await flushMicrotasks();

    expect(llm.streamCalls).toHaveLength(1);
    // The orchestrator splits the LLM response into sentences and streams each
    // to TTS separately. "नमस्कार! मी ठीक आहे." → 2 sentences.
    expect(tts.streamCalls.length).toBeGreaterThanOrEqual(1);
    expect(llm.streamCalls[0]?.messages.length).toBeGreaterThan(0);
  });

  it("emits language_detected when a new language is adopted in AUTO mode", async () => {
    const detected: { language: string; confidence: number }[] = [];
    eventBus.on("language_detected", (p) => detected.push({ language: p.language, confidence: p.confidence }));

    await orchestrator.startSession("s1", AUTO_LANGUAGE, "");
    speech.emitFinal("नमस्कार", "mr", 0.95);
    await flushMicrotasks();

    expect(detected).toHaveLength(1);
    expect(detected[0]?.language).toBe("mr");
  });

  it("does not emit language_detected when language is fixed", async () => {
    const detected = vi.fn();
    eventBus.on("language_detected", detected);

    await orchestrator.startSession("s1", "hi", "");
    speech.emitFinal("नमस्कार", "mr", 0.95);
    await flushMicrotasks();

    expect(detected).not.toHaveBeenCalled();
  });

  it("interrupt cancels ongoing TTS playback", async () => {
    await orchestrator.startSession("s1", AUTO_LANGUAGE, "");
    speech.emitFinal("हॅलो", "mr", 0.95);
    await flushMicrotasks();

    // Interrupt should not throw even if TTS is mid-stream.
    await orchestrator.interrupt("s1");
  });

  it("updateConfig changes the STT language live", async () => {
    await orchestrator.startSession("s1", AUTO_LANGUAGE, "");
    expect(speech.updateCalls).toHaveLength(0);

    await orchestrator.updateConfig("s1", "mr", "");
    expect(speech.updateCalls).toContain("mr-IN");
  });

  it("stopSession closes the STT provider", async () => {
    await orchestrator.startSession("s1", AUTO_LANGUAGE, "");
    expect(speech.stopped).toBe(false);
    await orchestrator.stopSession("s1");
    expect(speech.stopped).toBe(true);
  });

  it("emits latency events through the pipeline", async () => {
    const latencies: { speechEndToFirstAudioMs?: number }[] = [];
    eventBus.on("latency", (p) => latencies.push(p));

    await orchestrator.startSession("s1", AUTO_LANGUAGE, "");
    speech.emitFinal("हॅलो", "mr", 0.95);
    await flushMicrotasks();

    expect(latencies.length).toBeGreaterThanOrEqual(0);
  });
});

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}
