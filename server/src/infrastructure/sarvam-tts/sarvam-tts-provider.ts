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
 */
export class SarvamTtsProvider implements TTSProvider {
  readonly name = "sarvam-tts";

  private readonly apiKey: string;
  private readonly baseUrl: string;
  /** Output sample rate shared with the client so it builds the right AudioContext. */
  readonly outputSampleRate = 24000;

  constructor(apiKey: string, baseUrl = "https://api.sarvam.ai") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
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

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/text-to-speech/stream`, {
        method: "POST",
        headers: {
          "api-subscription-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: request.signal,
      });
    } catch (err) {
      if (request.signal.aborted) return;
      handlers.onError?.({
        code: "TTS_REQUEST_FAILED",
        message: err instanceof Error ? err.message : String(err),
        recoverable: true,
        provider: this.name,
      });
      return;
    }

    if (!response.ok || !response.body) {
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
        if (firstAudio) {
          firstAudio = false;
          handlers.onFirstAudio?.();
        }
        handlers.onChunk?.(bufferToBase64(value), this.outputSampleRate);
      }
      handlers.onComplete?.();
    } catch (err) {
      if (request.signal.aborted) return;
      handlers.onError?.({
        code: "TTS_STREAM_READ_FAILED",
        message: err instanceof Error ? err.message : String(err),
        recoverable: true,
        provider: this.name,
      });
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
