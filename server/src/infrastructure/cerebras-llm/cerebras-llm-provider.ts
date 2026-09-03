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
 */
export class CerebrasLlmProvider implements LLMProvider {
  readonly name = "cerebras-llm";

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, baseUrl = "https://api.cerebras.ai/v1", model = "gpt-oss-120b") {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
    this.model = model;
  }

  async streamResponse(request: LLMRequest, handlers: LLMStreamHandlers): Promise<void> {
    let firstToken = true;
    let full = "";

    try {
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
      }, { signal: request.signal });

      for await (const chunk of stream) {
        if (request.signal.aborted) break;
        const delta = chunk.choices?.[0]?.delta?.content;
        if (!delta) continue;
        if (firstToken) {
          firstToken = false;
          handlers.onFirstToken?.();
        }
        full += delta;
        handlers.onChunk?.(delta);
      }

      if (request.signal.aborted) return;
      handlers.onComplete?.(full);
    } catch (err) {
      if (request.signal.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      handlers.onError?.({
        code: "LLM_STREAM_FAILED",
        message,
        recoverable: true,
        provider: this.name,
      });
      throw new LLMProviderError(message, { cause: err });
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
