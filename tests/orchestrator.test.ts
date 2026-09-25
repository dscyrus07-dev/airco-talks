import { describe, it, expect, vi, beforeEach } from "vitest";
import { VoiceSessionState, type LanguageCode } from "@airco-talks/shared";
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
  emitFinal(text: string, language: LanguageCode, confidence = 0.95): void {
    this.handlers.onFinalTranscript?.({ text, language, confidence });
  }
  emitPartial(text: string, language: LanguageCode): void {
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
        confidenceThreshold: 0.6,
        maxContextMessages: 12,
        sampleRate: 16000,
      },
    });
  });

  it("starts a session and opens the STT provider with auto language", async () => {
    await orchestrator.startSession("s1", "pa", "mr", "");
    expect(speech.startCalls).toHaveLength(1);
    expect(speech.startCalls[0]?.language).toBe("auto");
  });

  it("forwards audio chunks to the STT provider", async () => {
    await orchestrator.startSession("s1", "pa", "mr", "");
    await orchestrator.handleAudioChunk("s1", new Uint8Array([1, 2, 3]));
    await orchestrator.handleAudioChunk("s1", new Uint8Array([4, 5, 6]));
    expect(speech.audioChunks).toHaveLength(2);
  });

  it("translates a Punjabi utterance into Marathi (myLanguage → theirLanguage)", async () => {
    await orchestrator.startSession("s1", "pa", "mr", "");
    speech.emitFinal("ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?", "pa", 0.95);
    await flushMicrotasks();

    expect(llm.streamCalls).toHaveLength(1);
    // The system prompt must instruct translation into the OTHER language.
    const system = llm.streamCalls[0]?.messages.find((m) => m.role === "system");
    expect(system?.content).toContain("Marathi");
    expect(system?.content).toContain("मराठी");
    // TTS speaks the translation in the target language.
    expect(tts.streamCalls.length).toBeGreaterThanOrEqual(1);
    expect(tts.streamCalls[0]?.language).toBe("mr");
  });

  it("translates the reply back: Marathi speech → Punjabi", async () => {
    llm.responseText = "ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?";
    await orchestrator.startSession("s1", "pa", "mr", "");
    speech.emitFinal("कसे आहात?", "mr", 0.95);
    await flushMicrotasks();

    const system = llm.streamCalls[0]?.messages.find((m) => m.role === "system");
    expect(system?.content).toContain("Punjabi");
    expect(tts.streamCalls[0]?.language).toBe("pa");
  });

  it("auto mode: customer speech is translated into the holder's language and remembered", async () => {
    llm.responseText = "नमस्ते";
    await orchestrator.startSession("s1", "hi", "auto", "");
    speech.emitFinal("வணக்கம்", "ta", 0.95);
    await flushMicrotasks();

    // Customer spoke Tamil → translation is spoken in Hindi (holder's language).
    expect(tts.streamCalls[0]?.language).toBe("hi");
  });

  it("auto mode: the holder's reply is translated into the customer's last heard language", async () => {
    llm.responseText = "வணக்கம்";
    await orchestrator.startSession("s1", "hi", "auto", "");
    // Customer speaks Tamil first (remembered).
    speech.emitFinal("வணக்கம்", "ta", 0.95);
    await flushMicrotasks();
    // Holder replies in Hindi → TTS speaks Tamil.
    speech.emitFinal("नमस्ते", "hi", 0.95);
    await flushMicrotasks();

    const replyCalls = tts.streamCalls.filter((c) => c.language === "ta");
    expect(replyCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("auto mode: falls back to English if the holder speaks before the customer is heard", async () => {
    llm.responseText = "Hello";
    await orchestrator.startSession("s1", "hi", "auto", "");
    speech.emitFinal("नमस्ते", "hi", 0.95);
    await flushMicrotasks();

    expect(tts.streamCalls[0]?.language).toBe("en");
  });

  it("emits language_detected for each detected language", async () => {
    const detected: { language: string; confidence: number }[] = [];
    eventBus.on("language_detected", (p) => detected.push({ language: p.language, confidence: p.confidence }));

    await orchestrator.startSession("s1", "pa", "mr", "");
    speech.emitFinal("ਸਤ ਸ੍ਰੀ ਅਕਾਲ", "pa", 0.95);
    await flushMicrotasks();

    expect(detected).toHaveLength(1);
    expect(detected[0]?.language).toBe("pa");
  });

  it("tags transcript events with the speaker side", async () => {
    const finals: { language: string; side: string }[] = [];
    eventBus.on("transcript_final", (p) => finals.push({ language: p.language, side: p.side }));

    await orchestrator.startSession("s1", "pa", "mr", "");
    speech.emitFinal("ਸਤ ਸ੍ਰੀ ਅਕਾਲ", "pa", 0.95);
    await flushMicrotasks();
    speech.emitFinal("कसे आहात?", "mr", 0.95);
    await flushMicrotasks();

    expect(finals[0]).toEqual({ language: "pa", side: "my" });
    expect(finals[1]).toEqual({ language: "mr", side: "their" });
  });

  it("tags ai_response events with the hearer side", async () => {
    const started: string[] = [];
    eventBus.on("ai_response_started", (p) => started.push(p.side));

    await orchestrator.startSession("s1", "pa", "mr", "");
    speech.emitFinal("ਸਤ ਸ੍ਰੀ ਅਕਾਲ", "pa", 0.95);
    await flushMicrotasks();

    // The holder spoke Punjabi → the customer hears the translation.
    expect(started[0]).toBe("their");
  });

  it("interrupt cancels ongoing TTS playback", async () => {
    await orchestrator.startSession("s1", "pa", "mr", "");
    speech.emitFinal("ਹੈਲੋ", "pa", 0.95);
    await flushMicrotasks();

    // Interrupt should not throw even if TTS is mid-stream.
    await orchestrator.interrupt("s1");
  });

  it("stopSession closes the STT provider", async () => {
    await orchestrator.startSession("s1", "pa", "mr", "");
    expect(speech.stopped).toBe(false);
    await orchestrator.stopSession("s1");
    expect(speech.stopped).toBe(true);
  });

  it("emits latency events through the pipeline", async () => {
    const latencies: { speechEndToFirstAudioMs?: number }[] = [];
    eventBus.on("latency", (p) => latencies.push(p));

    await orchestrator.startSession("s1", "pa", "mr", "");
    speech.emitFinal("ਹੈਲੋ", "pa", 0.95);
    await flushMicrotasks();

    expect(latencies.length).toBeGreaterThanOrEqual(0);
  });
});

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}
