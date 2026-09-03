# Decision Log

## STT Provider: Sarvam AI Saaras v3-realtime

**Decision**: Sarvam AI Saaras v3-realtime WebSocket streaming.

**Rationale**:
- Native support for 23 Indian languages including Marathi, Hindi, Tamil, Telugu, etc.
- Real-time WebSocket endpoint (`/speech-to-text-realtime/ws`) with true partial transcripts
- `language_code=auto` for native adaptive language detection (no client-side detection needed)
- `stream_type=fast` for lowest partial-transcript latency (voice agent optimized)
- VAD endpointing with millisecond-based tuning (`silence_duration_ms`, `min_speech_duration_ms`)
- Mid-call reconfiguration via `config.update` (live language switch without reconnect)
- Sub-150ms time-to-first-token

**Alternatives considered**:
- **AssemblyAI**: Lacked real-time streaming for most target Indian languages (Marathi, Tamil, Telugu). Not viable.
- **Google Cloud Speech-to-Text**: Good Indic coverage but lacks native `auto` detection for Indic languages and has higher latency for streaming.
- **Azure AI Speech**: Good Indic coverage but more expensive and complex to integrate for streaming.

## TTS Provider: Sarvam AI Bulbul v3

**Decision**: Sarvam AI Bulbul v3 via HTTP streaming endpoint.

**Rationale**:
- Superior Marathi voice quality (native speaker quality, not transliterated Hindi)
- Native code-switching support (Hindi-English, Marathi-English mixed text)
- 40+ voices across all 10 target languages
- HTTP streaming (`POST /text-to-speech/stream`) returns raw binary audio — chunks arrive as soon as synthesized
- `linear16` PCM output at 24 kHz — browser plays chunks directly via Web Audio API with no MP3 decoding step
- Sub-250ms time-to-first-byte
- `enable_preprocessing: true` normalizes English words and numbers in mixed-language text

**Why HTTP streaming over WebSocket**: Our architecture sends one TTS request per LLM sentence. HTTP streaming is simpler (no connection lifecycle, no config message, no ping/keepalive) and sufficient for per-sentence synthesis. The WebSocket endpoint is better for multi-turn reuse; we don't need that since each sentence is independent.

**Alternatives considered**:
- **Azure AI Speech**: Good Indic coverage but lacks native code-switching and Marathi-specific quality.
- **Google Cloud TTS**: No true streaming synthesis (returns complete audio files).

## LLM Provider: Cerebras gpt-oss-120b

**Decision**: Cerebras Inference with gpt-oss-120b.

**Rationale**:
- Ultra-low-latency inference (~3000 tokens/sec) — critical for voice-first time-to-first-audio
- OpenAI-compatible API (drop-in `openai` npm package)
- Streaming support (token-by-token)
- `reasoning_effort: "low"` + `reasoning_format: "hidden"` minimize reasoning tokens so the first content token arrives fast
- Strong multilingual capability across all 10 target languages

**Alternatives considered**:
- **Google Gemini Flash**: Good streaming and multilingual support, but higher latency than Cerebras for inference.
- **OpenAI GPT-4o-mini**: Good multilingual support but higher latency and cost.

## Audio Format: linear16 PCM (not MP3)

**Decision**: Use `linear16` PCM at 24 kHz for TTS output instead of MP3.

**Rationale**:
- The browser's Web Audio API can play PCM chunks directly via `AudioBufferSourceNode` — no decoding step
- MP3 decoding in the browser adds latency (decode → schedule → play vs. schedule → play)
- PCM chunks are slightly larger on the wire but the latency savings outweigh bandwidth
- 24 kHz matches Bulbul v3's default sample rate (no resampling needed)

## Architecture: Domain-First with DI

**Decision**: Layered architecture (Domain → Application → Infrastructure → Presentation) with constructor-based dependency injection.

**Rationale**:
- Business logic (orchestrator, conversation manager, language service) is decoupled from specific providers
- Every provider is behind an interface (`SpeechRecognitionProvider`, `LLMProvider`, `TTSProvider`)
- Providers can be swapped without touching business logic
- Every component is testable in isolation (mock providers in `tests/orchestrator.test.ts`)
- Follows SOLID, DRY, KISS, SoC, SRP principles

## Language Detection: Provider-Native Auto (not client-side)

**Decision**: Use Sarvam's native `language_code=auto` detection rather than client-side or LLM-based detection.

**Rationale**:
- Sarvam's realtime endpoint detects language on every partial/final transcript with `language_probability`
- Client-side detection from Unicode script is unreliable (Marathi and Hindi share Devanagari)
- LLM-based detection adds a round-trip and latency
- Native detection is the fastest and most accurate for Indic languages
- The orchestrator adopts the detected language only if confidence ≥ 0.6 (avoids flapping on borrowed English words)

## Barge-in: Client-Side Level Detection

**Decision**: Browser-side microphone level polling (80ms interval, 3 consecutive frames above threshold).

**Rationale**:
- Server-side VAD would require streaming mic audio even while AI is speaking (double bandwidth)
- The browser already has the AudioWorklet running; checking the level is free
- 3 consecutive frames (~240ms) above threshold avoids false triggers from AI audio bleeding into the mic
- `echoCancellation: true` in `getUserMedia` further reduces self-triggering
- The server-side orchestrator handles the actual cancellation (abort TTS, stop playback, transition state)
