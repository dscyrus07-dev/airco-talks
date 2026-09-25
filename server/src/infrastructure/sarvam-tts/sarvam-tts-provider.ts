import { getLanguage, type LanguageCode } from "@airco-talks/shared";
import type { TTSProvider, TTSRequest, TTSStreamHandlers } from "../../domain/interfaces/tts-provider.js";
import { TTSProviderError } from "../errors/typed-errors.js";

/**
 * Sarvam Bulbul v3 TTS via the HTTP streaming endpoint.
 *
 * Protocol (verified against Sarvam docs, Aug 2026):
 *  - POST https://api.sarvam.ai/text-to-speech/stream
 *  - Auth: api-subscription-key header
 *  - Body: { text, language_code, speaker, model, output_audio_codec, speech_sample_rate, ... }
 *  - Response: a raw binary audio stream — chunks arrive as soon as synthesized.
 *
 * We request linear16 PCM at 24 kHz so the browser can play chunks directly via
 * the Web Audio API with no MP3 decoding step (minimizes time-to-first-audio).
 *
 * A watchdog aborts the request when Sarvam stalls — no response headers or no
 * audio chunk for {@link timeoutMs} — so a hung synthesis can never freeze the
 * conversation. The orchestrator turns the resulting error into a recoverable
 * ERROR state.
 */
export class SarvamTtsProvider implements TTSProvider {
  readonly name = "sarvam-tts";

  private readonly apiKey: string;
  private readonly baseUrl: string;
  /** Output sample rate shared with the client so it builds the right AudioContext. */
  readonly outputSampleRate = 24000;
  private readonly timeoutMs: number;

  constructor(apiKey: string, baseUrl = "https://api.sarvam.ai", timeoutMs = 15_000) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  async streamSynthesis(request: TTSRequest, handlers: TTSStreamHandlers): Promise<void> {
    const speaker = request.voice || getLanguage(request.language).defaultVoice;
    const body = {
      text: request.text,
      language_code: getLanguage(request.language).locale,
      speaker,
      model: "bulbul:v3",
      output_audio_codec: "linear16",
      speech_sample_rate: this.outputSampleRate,
      enable_preprocessing: true,
      pace: 1.0,
    };

    // Watchdog: abort when the provider stalls (connect, first byte, or any
    // inter-chunk gap longer than timeoutMs).
    const watchdog = new AbortController();
    const onExternalAbort = () => watchdog.abort();
    request.signal.addEventListener("abort", onExternalAbort);
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => watchdog.abort(), this.timeoutMs);
    };

    let response: Response;
    try {
      arm();
      response = await fetch(`${this.baseUrl}/text-to-speech/stream`, {
        method: "POST",
        headers: {
          "api-subscription-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: watchdog.signal,
      });
      arm();
    } catch (err) {
      if (stallTimer) clearTimeout(stallTimer);
      request.signal.removeEventListener("abort", onExternalAbort);
      if (request.signal.aborted) return;
      const timedOut = watchdog.signal.aborted;
      handlers.onError?.({
        code: timedOut ? "TTS_TIMEOUT" : "TTS_REQUEST_FAILED",
        message: timedOut
          ? `TTS stalled — no response within ${this.timeoutMs}ms`
          : err instanceof Error ? err.message : String(err),
        recoverable: true,
        provider: this.name,
      });
      return;
    }

    if (!response.ok || !response.body) {
      if (stallTimer) clearTimeout(stallTimer);
      request.signal.removeEventListener("abort", onExternalAbort);
      const text = await response.text().catch(() => "");
      handlers.onError?.({
        code: `TTS_HTTP_${response.status}`,
        message: `TTS stream failed (${response.status}) ${text.slice(0, 200)}`,
        recoverable: response.status >= 500 || response.status === 429,
        provider: this.name,
      });
      return;
    }

    try {
      const reader = response.body.getReader();
      let firstAudio = true;
      while (true) {
        if (request.signal.aborted) {
          await reader.cancel().catch(() => undefined);
          return;
        }
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.length === 0) continue;
        arm(); // progress — re-arm the stall timer
        if (firstAudio) {
          firstAudio = false;
          handlers.onFirstAudio?.();
        }
        handlers.onChunk?.(bufferToBase64(value), this.outputSampleRate);
      }
      handlers.onComplete?.();
    } catch (err) {
      if (request.signal.aborted) return;
      const timedOut = watchdog.signal.aborted;
      handlers.onError?.({
        code: timedOut ? "TTS_TIMEOUT" : "TTS_STREAM_READ_FAILED",
        message: timedOut
          ? `TTS stalled — no audio within ${this.timeoutMs}ms`
          : err instanceof Error ? err.message : String(err),
        recoverable: true,
        provider: this.name,
      });
    } finally {
      if (stallTimer) clearTimeout(stallTimer);
      request.signal.removeEventListener("abort", onExternalAbort);
    }
  }

  getVoices(_language: LanguageCode): string[] {
    // Valid Bulbul v3 speakers (verified via API error response, Sep 2026).
    return [
      "aditya", "ritu", "ashutosh", "priya", "neha", "rahul", "pooja", "rohan",
      "simran", "kavya", "amit", "dev",
    ];
  }

  async healthCheck(): Promise<boolean> {
    return this.apiKey.length > 0;
  }
}

function bufferToBase64(data: Uint8Array): string {
  // Node fetch returns Uint8Array chunks; Buffer.from wraps without copy.
  return Buffer.from(data).toString("base64");
}
