import { getLanguage, type LanguageCode } from "@airco-talks/shared";
import type { TTSProvider, TTSRequest, TTSStreamHandlers } from "../../domain/interfaces/tts-provider.js";
import { TTSProviderError } from "../errors/typed-errors.js";

/** Delay before each retry of a transient TTS failure. */
const RETRY_DELAYS_MS = [400, 1200];

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
 * Resilience:
 *  - Watchdog: the request is aborted when Sarvam stalls (no response headers
 *    or no audio chunk for {@link timeoutMs}) so a hung synthesis can never
 *    freeze the conversation.
 *  - Retries: transient failures (429/5xx/network) are retried with a short
 *    backoff — but only before any audio chunk was streamed, so partial audio
 *    is never duplicated.
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
    const body = JSON.stringify({
      text: request.text,
      language_code: getLanguage(request.language).locale,
      speaker,
      model: "bulbul:v3",
      output_audio_codec: "linear16",
      speech_sample_rate: this.outputSampleRate,
      enable_preprocessing: true,
      pace: 1.0,
    });

    const maxAttempts = 1 + RETRY_DELAYS_MS.length;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const outcome = await this.streamAttempt(body, request, handlers);
      if (outcome !== "retry") return;
      if (attempt < maxAttempts) {
        const delay = RETRY_DELAYS_MS[attempt - 1] ?? 1200;
        await new Promise((r) => setTimeout(r, delay));
        if (request.signal.aborted) return;
      }
    }
    // Every attempt failed before any audio streamed — surface a friendly,
    // recoverable error instead of leaving the turn hanging.
    handlers.onError?.({
      code: "TTS_UNAVAILABLE",
      message: "Speech service is busy — please try again in a moment",
      recoverable: true,
      provider: this.name,
    });
  }

  /**
   * One synthesis attempt. Returns "retry" only for transient failures that
   * happened before ANY audio was streamed (safe to start over).
   */
  private async streamAttempt(
    body: string,
    request: TTSRequest,
    handlers: TTSStreamHandlers,
  ): Promise<"done" | "aborted" | "retry"> {
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
        body,
        signal: watchdog.signal,
      });
      arm();
    } catch (err) {
      if (stallTimer) clearTimeout(stallTimer);
      request.signal.removeEventListener("abort", onExternalAbort);
      if (request.signal.aborted) return "aborted";
      const timedOut = watchdog.signal.aborted;
      // Network-level failures before any audio are retriable.
      if (!timedOut) return "retry";
      handlers.onError?.({
        code: "TTS_TIMEOUT",
        message: `TTS stalled — no response within ${this.timeoutMs}ms`,
        recoverable: true,
        provider: this.name,
      });
      return "aborted";
    }

    if (!response.ok || !response.body) {
      if (stallTimer) clearTimeout(stallTimer);
      request.signal.removeEventListener("abort", onExternalAbort);
      const text = await response.text().catch(() => "");
      const transient = response.status === 429 || response.status >= 500;
      if (transient) return "retry";
      handlers.onError?.({
        code: `TTS_HTTP_${response.status}`,
        message: `TTS stream failed (${response.status}) ${text.slice(0, 200)}`,
        recoverable: response.status >= 500 || response.status === 429,
        provider: this.name,
      });
      return "aborted";
    }

    try {
      const reader = response.body!.getReader();
      let firstAudio = true;
      while (true) {
        if (request.signal.aborted) {
          await reader.cancel().catch(() => undefined);
          return "aborted";
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
      return "done";
    } catch (err) {
      if (request.signal.aborted) return "aborted";
      const timedOut = watchdog.signal.aborted;
      handlers.onError?.({
        code: timedOut ? "TTS_TIMEOUT" : "TTS_STREAM_READ_FAILED",
        message: timedOut
          ? `TTS stalled — no audio within ${this.timeoutMs}ms`
          : err instanceof Error ? err.message : String(err),
        recoverable: true,
        provider: this.name,
      });
      return "aborted";
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
