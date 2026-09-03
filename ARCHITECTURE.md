# Architecture

## Overview

DHVANI AI is a real-time voice-to-voice conversational AI built with a domain-first, layered architecture. The system streams audio from the user's microphone through STT → LLM → TTS and back to the speaker with minimal latency, supporting 10 Indian languages with automatic detection and barge-in.

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
│  CerebrasLlmProvider, DhvaniWebSocketServer,             │
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
Browser Mic
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
                              PromptBuilder (system + context)
                                    │
                                    ▼
                              CerebrasLLMProvider (streaming)
                                    │ (token-by-token)
                                    ▼
                              Sentence Splitter
                                    │ (per sentence)
                                    ▼
                              SarvamTtsProvider (HTTP stream)
                                    │ (linear16 PCM, 24kHz)
                                    ▼
                              WebSocket ──▶ Browser AudioPlayer
                                    │              │
                                    │              ▼
                                    │         Speakers ◄
                                    │
                              Barge-in detector (mic level)
                                    │ (if user speaks during AI speech)
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
  config: { defaultAutoLanguage: "hi", confidenceThreshold: 0.6, ... },
});
```

This makes every provider swappable and every component testable in isolation (see `tests/orchestrator.test.ts` which uses mock providers).

## WebSocket Protocol

All client→server messages are validated with Zod discriminated unions before the orchestrator acts on them. Server→client messages are typed and validated with `isServerMessage()` on the client side.

**Client → Server:**
- `start_session` — `{ type, sessionId?, language, voice? }`
- `audio_chunk` — `{ type, sessionId, data (base64 PCM) }`
- `interrupt` — `{ type, sessionId }` (barge-in)
- `update_config` — `{ type, sessionId, language?, voice? }`
- `stop_session` — `{ type, sessionId }`

**Server → Client:**
- `session_started`, `state_changed`, `transcript_partial`, `transcript_final`
- `language_detected`, `ai_response_started`, `ai_response_chunk`, `ai_response_completed`
- `audio_chunk` (base64 PCM + sampleRate), `ai_speech_ended`, `latency`, `error`

## Audio Format

- **Microphone → Server**: 16 kHz mono 16-bit linear PCM, base64-encoded, ~100ms chunks
- **Server → Speakers**: 24 kHz mono 16-bit linear PCM, base64-encoded, streamed

The browser uses an AudioWorklet (`public/pcm-processor.js`) for low-latency capture and the Web Audio API (`AudioBufferSourceNode`) for gapless playback.

## Language Detection Strategy

1. **AUTO mode** (default): STT uses `language_code=auto` (Sarvam native detection). The orchestrator adopts the detected language if confidence ≥ threshold (0.6). The LLM is instructed to respond in the preferred language.
2. **Fixed mode**: User selects a language in settings. STT is pinned to that locale. The LLM always responds in that language.
3. **Code-switching**: A few English words in a Marathi sentence do NOT trigger a language switch. Only a full turn in another language (or explicit request) switches.

## Barge-in

When the AI is speaking (`AI_SPEAKING` state), the browser polls the microphone input level every 80ms. If the level exceeds a threshold for 3 consecutive checks (~240ms), the client sends an `interrupt` message. The orchestrator:
1. Aborts the TTS stream (AbortController)
2. Transitions to `USER_INTERRUPT`
3. The browser stops audio playback immediately
4. STT continues listening — the user's interruption is transcribed and processed
