import OpenAI from "openai";
import type { LLMProvider, LLMRequest, LLMStreamHandlers, ChatMessage } from "../../domain/interfaces/llm-provider.js";
import type { ProviderErrorEvent } from "../../domain/interfaces/speech-recognition-provider.js";
import { LLMProviderError } from "../errors/typed-errors.js";

/** Delay before each retry of a transient provider failure. */
const RETRY_DELAYS_MS = [400, 1200];

/**
 * Cerebras Inference LLM (gpt-oss-120b) via the OpenAI-compatible API.
 *
 * Verified against Cerebras docs (Aug 2026):
 *  - base URL: https://api.cerebras.ai/v1
 *  - model: gpt-oss-120b (~3000 tok/s, streaming supported)
 *  - reasoning_effort: "low" minimizes reasoning tokens so the first content
 *    token (and therefore TTS) arrives fast.
 *
 * Resilience:
 *  - Watchdog: the stream is aborted when the provider stalls (no first token
 *    or no chunk for {@link timeoutMs}) so a hung request can never freeze the
 *    conversation in PROCESSING.
 *  - Retries: transient failures (429/5xx/network) are retried with a short
 *    backoff — but only while NOTHING has been streamed, so partial output is
 *    never duplicated.
 */
export class CerebrasLlmProvider implements LLMProvider {
  readonly name = "cerebras-llm";

  private readonly client: OpenAI;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, baseUrl = "https://api.cerebras.ai/v1", model = "gpt-oss-120b", timeoutMs = 15_000) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async streamResponse(request: LLMRequest, handlers: LLMStreamHandlers): Promise<void> {
    const maxAttempts = 1 + RETRY_DELAYS_MS.length;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const outcome = await this.streamAttempt(request, handlers);
      if (outcome !== "retry") return;
      if (attempt < maxAttempts) {
        const delay = RETRY_DELAYS_MS[attempt - 1] ?? 1200;
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (request.signal.aborted) return;
      }
    }
    // Every attempt failed with a transient error before any token streamed.
    handlers.onError?.({
      code: "LLM_UNAVAILABLE",
      message: "Translation service is busy — please try again in a moment",
      recoverable: true,
      provider: this.name,
    });
  }

  /** One streaming attempt. Fatal errors are reported via handlers.onError. */
  private async streamAttempt(
    request: LLMRequest,
    handlers: LLMStreamHandlers,
  ): Promise<"done" | "aborted" | "retry"> {
    let firstToken = true;
    let full = "";

    // Watchdog: abort when the provider stalls. Re-armed on every progress
    // event (first token, each chunk) so slow-but-alive streams are fine.
    const watchdog = new AbortController();
    const onExternalAbort = () => watchdog.abort();
    request.signal.addEventListener("abort", onExternalAbort);
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => watchdog.abort(), this.timeoutMs);
    };

    try {
      arm();
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: request.messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
        stream: true as const,
        temperature: 0.7,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reasoning_effort: "low" as any,
      }, { signal: watchdog.signal });

      for await (const chunk of stream) {
        if (request.signal.aborted) return "aborted";
        const delta = chunk.choices?.[0]?.delta?.content;
        if (!delta) continue;
        arm(); // progress — re-arm the stall timer
        if (firstToken) {
          firstToken = false;
          handlers.onFirstToken?.();
        }
        full += delta;
        handlers.onChunk?.(delta);
      }

      if (request.signal.aborted) return "aborted";
      handlers.onComplete?.(full);
      return "done";
    } catch (err) {
      if (request.signal.aborted) return "aborted";
      const timedOut = watchdog.signal.aborted;
      const status = typeof (err as { status?: unknown }).status === "number"
        ? (err as { status?: number }).status
        : undefined;
      // Nothing streamed yet + provider-side transient failure → safe to retry.
      if (firstToken && (status === 429 || (status !== undefined && status >= 500))) {
        return "retry";
      }

      const message = timedOut
        ? `LLM stalled — no response within ${this.timeoutMs}ms`
        : status === 429 || (status !== undefined && status >= 500)
          ? "Translation service is busy — please try again in a moment"
          : err instanceof Error ? err.message : String(err);
      handlers.onError?.({
        code: timedOut ? "LLM_TIMEOUT" : "LLM_STREAM_FAILED",
        message,
        recoverable: true,
        provider: this.name,
      });
      throw new LLMProviderError(message, { cause: err });
    } finally {
      if (stallTimer) clearTimeout(stallTimer);
      request.signal.removeEventListener("abort", onExternalAbort);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.client.models.list();
      return res.data.length > 0;
    } catch {
      return false;
    }
  }
}
