# AGENTS.md — Project Guide for AI Agents

## Project

Airco Talks — real-time two-way voice translator for Indian languages. Two people who speak different languages talk face-to-face over one device; each hears the other in their own language.

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

# Run all tests (100+ unit + integration tests)
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

- **shared/**: TypeScript package with Zod-validated WebSocket protocol, language definitions, state machine, constants. Built to `dist/` and consumed by server + web via `@airco-talks/shared` workspace package.
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
- Translation direction policy lives ONLY in `LanguageService.resolveTranslationTarget` — fixed pair: detected language → the other language; auto mode (`theirLanguage: "auto"`): customer's language is detected + remembered, holder replies go to the customer's last heard language (fallback "en")
- Turn relay lives in the orchestrator + `LanguageService.isOutOfTurn`: after a translation starts the floor passes to the hearer; out-of-turn speech is dropped (fail-open on ambiguous detections); `TURN_TIMEOUT_MS` (default 12s) auto-releases a silent floor
- The LLM is a TRANSLATOR: `buildTranslationPrompt` forbids answering or continuing the speaker's words. Do not reintroduce chatbot behavior in prompts.

## Environment Variables

Required in `.env` (see `.env.example`):
- `SARVAM_API_KEY` — Sarvam AI API key (STT + TTS)
- `CEREBRAS_API_KEY` — Cerebras API key (LLM)

Optional:
- `PORT` (default 8080), `WEB_ORIGIN` (default http://localhost:3000)
- `CEREBRAS_MODEL` (default gpt-oss-120b)
- `MAX_CONTEXT_MESSAGES` (default 12)
- `LANGUAGE_CONFIDENCE_THRESHOLD` (default 0.6)
- `STT_SAMPLE_RATE` (default 16000)
- `TTS_VOICE` (default empty = per-language default)
- `TURN_TIMEOUT_MS` (default 12000) — silence before a locked turn auto-releases
- `LLM_TIMEOUT_MS` (default 15000) — abort the LLM when Cerebras stalls
- `TTS_TIMEOUT_MS` (default 15000) — abort TTS when Sarvam stalls
- `LOG_LEVEL` (default info)

## Providers

- **STT**: Sarvam Saaras v3-realtime (`/speech-to-text-realtime/ws`), `language_code=auto`, `stream_type=fast`
- **LLM**: Cerebras gpt-oss-120b (OpenAI-compatible, `reasoning_effort: low`)
- **TTS**: Sarvam Bulbul v3 (`/text-to-speech/stream`), `linear16` PCM, 24 kHz

## gstack (ported from garrytan/gstack)

Behavioral rules from gstack, adapted for Windsurf. Workflows live in `.windsurf/workflows/gstack-*.md`:
`/gstack-review`, `/gstack-ceo-review`, `/gstack-eng-review`, `/gstack-investigate`, `/gstack-office-hours`, `/gstack-qa`. Full original skills: `C:\Users\admin\.claude\skills\gstack\<skill>\SKILL.md`.

### Ethos
- **Boil the Ocean** — AI makes completeness cheap, so do the complete thing: tests, edge cases, error paths. Shortcuts need an explicit, recorded decision.
- **Search Before Building** — know what exists before deciding what to build. Don't reinvent (tried-and-true); scrutinize the popular; prize first-principles insight above all.
- **User Sovereignty** — models recommend, the user decides. Ask before changing the user's stated direction.
- **Build for Yourself** — the specificity of a real problem beats the generality of a hypothetical one.

### The reuse ladder
Before writing new code, stop at the first rung that holds:
1. A helper, util, or pattern already in this repo.
2. The standard library.
3. A native platform feature (CSS over JS, DB constraint over app code).
4. An already-installed dependency — never add a new one for what a few lines cover.

Then build the complete version of what remains. Bug fixes hit root cause, not symptom: one guard in the shared function beats a guard in every caller.

### Voice
Direct, concrete, builder-to-builder. Name the file, function, command, and user-visible impact. Short paragraphs; end with what to do. No filler, no corporate tone, no AI vocabulary.
