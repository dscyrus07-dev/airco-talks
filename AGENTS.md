# AGENTS.md — Project Guide for AI Agents

## Project

Airco DHVANI AI — real-time voice-to-voice AI chatbot for Indian languages.

## Build & Test Commands

```bash
# Install all workspace dependencies
npm install

# Build shared package (REQUIRED before server/web typecheck/build)
npm run build --workspace shared

# Typecheck all packages
npm run typecheck --workspace shared
npm run typecheck --workspace server
npm run typecheck --workspace web

# Run all tests (110+ unit + integration tests)
npx vitest run

# Build all packages
npm run build --workspace shared
npm run build --workspace server
npm run build --workspace web

# Dev servers (run in separate terminals)
npm run dev --workspace server   # backend WS server on :8080
npm run dev --workspace web      # Next.js on :3000
```

## Architecture

- **shared/**: TypeScript package with Zod-validated WebSocket protocol, language definitions, state machine, constants. Built to `dist/` and consumed by server + web via `@dhvani/shared` workspace package.
- **server/**: Node.js backend. Domain-first layers: domain → application → infrastructure → entry. Provider interfaces in domain, implementations in infrastructure, wired via DI in `main.ts`.
- **web/**: Next.js 14 frontend. Hooks (`useVoiceSession`) compose lib layer (`WebSocketClient`, `AudioRecorder`, `AudioPlayer`) and feed visual components.

## Key Conventions

- TypeScript strict mode + `noUncheckedIndexedAccess` (always guard array access with `?? defaultValue`)
- `LanguageCode` is a string union type, NOT an enum — use string literals like `"mr"`, `"hi"`
- All WebSocket messages validated with Zod (`parseClientMessage` / `isServerMessage`)
- Provider interfaces use `SttLanguage = LanguageLocale | "auto"` for STT language
- Audio format: 16 kHz linear16 PCM (mic → server), 24 kHz linear16 PCM (server → speakers)
- No `any` — use `unknown` with type narrowing
- Constructor-based DI (composition over inheritance)
- `AppError` is the base error class; server has typed error subclasses in `infrastructure/errors/`

## Environment Variables

Required in `.env` (see `.env.example`):
- `SARVAM_API_KEY` — Sarvam AI API key (STT + TTS)
- `CEREBRAS_API_KEY` — Cerebras API key (LLM)

Optional:
- `PORT` (default 8080), `WEB_ORIGIN` (default http://localhost:3000)
- `CEREBRAS_MODEL` (default gpt-oss-120b)
- `DEFAULT_AUTO_LANGUAGE` (default hi-IN)
- `LANGUAGE_CONFIDENCE_THRESHOLD` (default 0.6)
- `MAX_CONTEXT_MESSAGES` (default 12)
- `STT_SAMPLE_RATE` (default 16000)
- `TTS_VOICE` (default empty = per-language default)
- `LOG_LEVEL` (default info)

## Providers

- **STT**: Sarvam Saaras v3-realtime (`/speech-to-text-realtime/ws`), `language_code=auto`, `stream_type=fast`
- **LLM**: Cerebras gpt-oss-120b (OpenAI-compatible, `reasoning_effort: low`)
- **TTS**: Sarvam Bulbul v3 (`/text-to-speech/stream`), `linear16` PCM, 24 kHz
