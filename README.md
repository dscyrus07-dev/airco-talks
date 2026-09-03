# Airco DHVANI AI

Real-time, voice-first AI chatbot that listens, understands, and responds in your native Indian language. Built for low-latency natural conversation with barge-in support.

## Supported Languages

Marathi, Hindi, English, Gujarati, Tamil, Telugu, Kannada, Malayalam, Bengali, Punjabi — with automatic language detection.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full layered design and [DECISIONS.md](./DECISIONS.md) for provider selection rationale.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **STT** | Sarvam AI Saaras v3-realtime (WebSocket streaming, `language_code=auto`) |
| **LLM** | Cerebras gpt-oss-120b (OpenAI-compatible, streaming, `reasoning_effort: low`) |
| **TTS** | Sarvam AI Bulbul v3 (HTTP streaming, linear16 PCM, 24 kHz) |
| **Backend** | Node.js + TypeScript (WebSocket server, DI, domain-first) |
| **Frontend** | Next.js 14 + React + TypeScript + Tailwind + Framer Motion |
| **Shared** | TypeScript package with Zod-validated WebSocket protocol |

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Sarvam AI API key ([dashboard.sarvam.ai](https://dashboard.sarvam.ai))
- Cerebras API key ([cloud.cerebras.ai](https://cloud.cerebras.ai))

### Setup

```bash
# Install dependencies (all workspaces)
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your SARVAM_API_KEY and CEREBRAS_API_KEY

# Build the shared package (required by server and web)
npm run build --workspace shared
```

### Run

```bash
# Terminal 1: backend WebSocket server (port 8080)
npm run dev --workspace server

# Terminal 2: frontend Next.js dev server (port 3000)
npm run dev --workspace web
```

Open [http://localhost:3000](http://localhost:3000), tap the microphone button, and start speaking.

### Quality Gate

```bash
npm run typecheck   # all packages
npm test            # 110+ unit + integration tests
npm run build       # all packages
```

## Project Structure

```
├── shared/              # Shared TypeScript package (types, Zod schemas, constants)
│   └── src/
│       ├── languages/   # LanguageCode, LANGUAGES, locale mapping
│       ├── protocol/    # WebSocket message schemas (ClientMessage / ServerMessage)
│       ├── state/       # VoiceSessionState enum + valid transitions
│       ├── constants.ts # App-wide constants
│       └── errors.ts    # AppError base class
├── server/              # Backend WebSocket server
│   └── src/
│       ├── domain/          # Entities, events, state machine, provider interfaces
│       ├── application/     # Orchestrator, conversation manager, language service, prompt builder
│       ├── infrastructure/  # Sarvam STT/TTS, Cerebras LLM, WebSocket server, config, logger
│       └── main.ts          # DI wiring + startup
├── web/                 # Next.js frontend
│   └── src/
│       ├── app/         # Next.js App Router (layout, page, globals)
│       ├── components/  # MicrophoneButton, AudioWaveform, StateIndicator, etc.
│       ├── hooks/       # useVoiceSession, useWebSocket, useMicrophone, useAudioPlayback
│       └── lib/         # WebSocket client, audio recorder (AudioWorklet), audio player
└── tests/               # Vitest unit + integration tests (110+ tests)
```

## Key Features

- **Voice-first**: Tap to speak, listen to the response. Text is secondary.
- **Automatic language detection**: Speak any supported language; the AI detects and responds in kind.
- **Barge-in**: Speak while the AI is talking — it stops, listens, and responds to your interruption.
- **Low latency**: Streaming STT → streaming LLM → streaming TTS → immediate PCM playback.
- **Code-switching**: Hindi-English, Marathi-English mixed speech is handled naturally.
- **Privacy**: Audio is processed in real-time and not permanently stored.

## Manual Testing

See [MANUAL_TEST_PLAN.md](./MANUAL_TEST_PLAN.md) for the full manual test checklist.

## Security

- API keys are stored in `.env` (gitignored). Never commit secrets.
- The `.env.example` file contains only placeholder values.
- The backend validates every incoming WebSocket message with Zod before acting.
- The logger scrubs keys that look like secrets (api-key, token, secret, password).
- WebSocket origin checking prevents cross-origin connections.

## License

Private. © Airco Insights Fintech.
