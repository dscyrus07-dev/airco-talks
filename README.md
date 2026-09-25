# Airco Talks

Real-time, two-way voice translator for Indian languages. Two people who don't share a language talk face-to-face: each speaks their own language, and Airco Talks translates every utterance aloud into the other person's language. Built for low latency with barge-in support.

## How It Works

1. Pick **your language** (e.g. Hindi) and the **customer's language** — or leave the customer's language on **Auto-detect**.
2. The customer speaks in their language. Airco Talks detects it, translates it into your language, and speaks it aloud for you.
3. You reply in your language. Airco Talks translates it into the customer's language and speaks it aloud for them.

With **Auto-detect**, the customer's language is detected from their first utterance and remembered — you never need to know what language they speak. It works like Google Translate's conversation mode — voice in, voice out, both directions.

## Supported Languages

Marathi, Hindi, English, Gujarati, Tamil, Telugu, Kannada, Malayalam, Bengali, Punjabi — with automatic per-utterance language detection.

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

### Run (local development only)

```bash
# Terminal 1: backend WebSocket server (port 8080)
npm run dev --workspace server

# Terminal 2: frontend Next.js dev server (port 3000)
npm run dev --workspace web
```

Open [http://localhost:3000](http://localhost:3000), pick the two languages in Settings, tap the microphone, and start talking.

### Quality Gate

```bash
npm run typecheck   # all packages
npm test            # 100+ unit + integration tests
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
│       ├── application/     # Orchestrator, conversation manager, language service, translation prompt
│       ├── infrastructure/  # Sarvam STT/TTS, Cerebras LLM, WebSocket server, config, logger
│       └── main.ts          # DI wiring + startup
├── web/                 # Next.js frontend
│   └── src/
│       ├── app/         # Next.js App Router (layout, page, globals)
│       ├── components/  # MicrophoneButton, LiveTranscript, SettingsPanel, etc.
│       ├── hooks/       # useVoiceSession, useWebSocket, useMicrophone, useAudioPlayback
│       └── lib/         # WebSocket client, audio recorder (AudioWorklet), audio player
└── tests/               # Vitest unit + integration tests
```

## Key Features

- **Two-way voice translation**: Each side hears the other in their own language — no menus, no typing.
- **Two-panel conversation view**: Separate windows for you and the customer, each with its own mic — you always see who is talking and which conversation is whose.
- **Auto-detect customer mode**: Select only YOUR language; the customer's language is detected automatically and remembered for your replies.
- **Automatic language detection per turn**: Whoever speaks, Sarvam detects the language and the translation flips direction automatically.
- **Barge-in**: Speak while the translation is playing — it stops, listens, and translates the interruption.
- **Low latency**: Streaming STT → streaming LLM translation → streaming TTS → immediate PCM playback.
- **Code-switching**: Hindi-English, Punjabi-English mixed speech is translated naturally.
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
