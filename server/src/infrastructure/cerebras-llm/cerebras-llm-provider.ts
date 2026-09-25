import OpenAI from "openai";
import type { LLMProvider, LLMRequest, LLMStreamHandlers, ChatMessage } from "../../domain/interfaces/llm-provider.js";
import { LLMProviderError } from "../errors/typed-errors.js";

/**
 * Cerebras Inference LLM (gpt-oss-120b) via the OpenAI-compatible API.
 *
 * Verified against Cerebras docs (Aug 2026):
 *  - base URL: https://api.cerebras.ai/v1
 *  - model: gpt-oss-120b (~3000 tok/s, streaming supported)
 *  - reasoning_effort: "low" + reasoning_format: "hidden" minimize reasoning
 *    tokens so the first content token (and therefore TTS) arrives fast.
 *  - The "system" role is mapped to developer-level instructions by Cerebras.
 *
 * A watchdog aborts the stream when the provider stalls — no first token, or
 * no chunk for {@link timeoutMs} — so a hung request can never freeze the
 * conversation in PROCESSING. The orchestrator turns the resulting error into
 * a recoverable ERROR state and returns to LISTENING.
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
    let firstToken = true;
    let full = "";

    // Watchdog: abort when the provider stalls. Aborts on every progress
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
      // Per Cerebras docs: reasoning_effort is a standard param. We use "low"
      // to minimize reasoning tokens so the first content token arrives fast.
      // (reasoning_format is omitted — the OpenAI SDK v4 doesn't forward it
      // correctly and reasoning_effort="low" alone is sufficient for speed.)
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: request.messages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
        stream: true as const,
        temperature: 0.7,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reasoning_effort: "low" as any,
      }, { signal: watchdog.signal });

      for await (const chunk of stream) {
        if (request.signal.aborted) break;
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

      if (stallTimer) clearTimeout(stallTimer);
      if (request.signal.aborted) return;
      handlers.onComplete?.(full);
    } catch (err) {
      if (stallTimer) clearTimeout(stallTimer);
      if (request.signal.aborted) return;
      const timedOut = watchdog.signal.aborted;
      const message = timedOut
        ? `LLM stalled — no response within ${this.timeoutMs}ms`
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
