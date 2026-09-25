# Architecture

## Overview

Airco Talks is a real-time two-way voice translator built with a domain-first, layered architecture. The system streams audio from the microphone through STT → LLM translation → TTS and back to the speaker with minimal latency, supporting 10 Indian languages with automatic per-utterance detection and barge-in.

## Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION (web/)                    │
│  Next.js + React + Tailwind + Framer Motion              │
│  Components: MicrophoneButton, AudioWaveform, etc.       │
│  Hooks: useVoiceSession, useWebSocket, useMicrophone     │
│  Lib: WebSocketClient, AudioRecorder (Worklet), Player   │
├─────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE (server/)               │
│  SarvamSpeechProvider, SarvamTtsProvider,                │
│  CerebrasLlmProvider, AircoTalksWebSocketServer,             │
│  ConfigService, ConsoleLogger, TypedErrors               │
├─────────────────────────────────────────────────────────┤
│                    APPLICATION (server/)                  │
│  VoiceConversationOrchestrator, ConversationManager,     │
│  LanguageService, PromptBuilder                          │
├─────────────────────────────────────────────────────────┤
│                    DOMAIN (server/)                       │
│  Conversation, Message entities, VoiceEvents, EventBus,  │
│  VoiceSessionStateMachine, Provider Interfaces           │
├─────────────────────────────────────────────────────────┤
│                    SHARED (shared/)                       │
│  LanguageCode, LANGUAGES, WebSocket Protocol (Zod),      │
│  VoiceSessionState, Constants, AppError                  │
└─────────────────────────────────────────────────────────┘
```

## Streaming Pipeline

```
Browser Mic (either person speaks)
    │ (16 kHz linear16 PCM, base64, ~100ms chunks)
    ▼
WebSocket ──▶ Orchestrator ──▶ SarvamSpeechProvider
                                    │ (WebSocket, language_code=auto)
                                    ▼
                              transcript.partial  ──▶  Browser (live caption)
                              transcript.final    ──▶  Orchestrator
                                                          │
                                    ┌─────────────────────┘
                                    ▼
                              LanguageService (translation direction:
                              detected language → the OTHER language of the pair)
                                    │
                                    ▼
                              buildTranslationPrompt (system + utterance)
                                    │
                                    ▼
                              CerebrasLLMProvider (streaming translation)
                                    │ (token-by-token)
                                    ▼
                              Sentence Splitter
                                    │ (per sentence)
                                    ▼
                              SarvamTtsProvider (HTTP stream, target language)
                                    │ (linear16 PCM, 24kHz)
                                    ▼
                              WebSocket ──▶ Browser AudioPlayer
                                    │              │
                                    │              ▼
                                    │         Speakers ◄
                                    │
                              Barge-in detector (mic level)
                                    │ (if someone speaks during playback)
                                    ▼
                              Cancel TTS + stop playback → LISTENING
```

## State Machine

```
IDLE → CONNECTING → LISTENING → USER_SPEAKING → PROCESSING → AI_SPEAKING → LISTENING
                                    ↑                ↑              │
                                    └────────────────┘              │
                                                              USER_INTERRUPT
                                                                    │
                                                                    ▼
                                                              USER_SPEAKING / PROCESSING

Any state → ERROR → CONNECTING (retry) / IDLE (reset)
Any state → ENDED → IDLE
```

## Dependency Injection

All providers are injected via constructor (composition over inheritance):

```typescript
new VoiceConversationOrchestrator({
  speechProvider: new SarvamSpeechProvider(apiKey),
  llmProvider: new CerebrasLlmProvider(apiKey),
  ttsProvider: new SarvamTtsProvider(apiKey),
  conversationManager: new ConversationManager(),
  languageService: new LanguageService(),
  eventBus: new EventBus(),
  logger: new ConsoleLogger("info"),
  config: { confidenceThreshold: 0.6, ... },
});
```

This makes every provider swappable and every component testable in isolation (see `tests/orchestrator.test.ts` which uses mock providers).

## WebSocket Protocol

All client→server messages are validated with Zod discriminated unions before the orchestrator acts on them. Server→client messages are typed and validated with `isServerMessage()` on the client side.

**Client → Server:**
- `start_session` — `{ type, sessionId?, myLanguage, theirLanguage, voice? }`
- `audio_chunk` — `{ type, sessionId, data (base64 PCM) }`
- `interrupt` — `{ type, sessionId }` (barge-in)
- `update_config` — `{ type, sessionId, myLanguage?, theirLanguage?, voice? }`
- `stop_session` — `{ type, sessionId }`

**Server → Client:**
- `session_started`, `state_changed`
- `transcript_partial` / `transcript_final` — `{ text, language, confidence?, side }` where `side` ("my" | "their") is the speaker's panel
- `language_detected`
- `ai_response_started` / `ai_response_chunk` / `ai_response_completed` — the response events carry `side` = the panel that HEARS the translation
- `audio_chunk` (base64 PCM + sampleRate), `ai_speech_ended`, `latency`, `error`

The `side` field drives the two-panel UI: spoken texts appear in the speaker's window, translations in the listener's window.

## Audio Format

- **Microphone → Server**: 16 kHz mono 16-bit linear PCM, base64-encoded, ~100ms chunks
- **Server → Speakers**: 24 kHz mono 16-bit linear PCM, base64-encoded, streamed

The browser uses an AudioWorklet (`public/pcm-processor.js`) for low-latency capture and the Web Audio API (`AudioBufferSourceNode`) for gapless playback.

## Translation Direction Strategy

1. **Your language is always fixed**: The client sends `myLanguage` (device holder) in `start_session`. `theirLanguage` is either a fixed code or `"auto"`.
2. **Fixed pair mode**: The detected language decides who spoke; every turn is translated into the other language of the pair. Detections outside the pair are assumed to come from the device holder (the mic is next to them).
3. **Auto-detect customer mode** (`theirLanguage: "auto"`): The customer's language is unknown up front. Detected languages that differ from `myLanguage` are treated as the customer speaking (translated into `myLanguage`) and remembered (confidence-gated). When the holder speaks, the reply is translated into the customer's last heard language — falling back to English if the customer hasn't been heard yet.
4. **Code-switching**: A few English words inside a Punjabi sentence do not change the direction — the LLM translates the full utterance into the target language, keeping commonly-used English words where natural.

## Barge-in

When the AI is speaking (`AI_SPEAKING` state), the browser polls the microphone input level every 80ms. If the level exceeds a threshold for 3 consecutive checks (~240ms), the client sends an `interrupt` message. The orchestrator:
1. Aborts the TTS stream (AbortController)
2. Transitions to `USER_INTERRUPT`
3. The browser stops audio playback immediately
4. STT continues listening — the user's interruption is transcribed and processed
