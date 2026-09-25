import { config } from "dotenv";
import { resolve } from "node:path";
// Load .env from the monorepo root (parent of server/), not the server/ dir.
config({ path: resolve(import.meta.dirname, "../../.env") });
import { ConfigService } from "./infrastructure/config/config-service.js";
import { ConsoleLogger } from "./infrastructure/logger/logger.js";
import { EventBus } from "./domain/event-bus.js";
import { LanguageService } from "./application/language-service.js";
import { ConversationManager } from "./application/conversation-manager.js";
import { SarvamSpeechProvider } from "./infrastructure/sarvam-stt/sarvam-speech-provider.js";
import { SarvamTtsProvider } from "./infrastructure/sarvam-tts/sarvam-tts-provider.js";
import { CerebrasLlmProvider } from "./infrastructure/cerebras-llm/cerebras-llm-provider.js";
import { VoiceConversationOrchestrator } from "./application/voice-conversation-orchestrator.js";
import { AircoTalksWebSocketServer } from "./infrastructure/websocket/websocket-server.js";

async function main(): Promise<void> {
  const config = new ConfigService().config;
  const logger = new ConsoleLogger(config.logLevel);
  const eventBus = new EventBus();

  const languageService = new LanguageService();
  const conversationManager = new ConversationManager();

  const speechProvider = new SarvamSpeechProvider(config.sarvam.apiKey, config.sarvam.baseUrl);
  const ttsProvider = new SarvamTtsProvider(config.sarvam.apiKey, config.sarvam.baseUrl, config.ttsTimeoutMs);
  const llmProvider = new CerebrasLlmProvider(
    config.cerebras.apiKey,
    config.cerebras.baseUrl,
    config.cerebras.model,
    config.cerebras.timeoutMs,
  );

  const orchestrator = new VoiceConversationOrchestrator({
    speechProvider,
    llmProvider,
    ttsProvider,
    conversationManager,
    languageService,
    eventBus,
    logger,
    config: {
      confidenceThreshold: config.confidenceThreshold,
      maxContextMessages: config.maxContextMessages,
      sampleRate: config.sampleRate,
      turnTimeoutMs: config.turnTimeoutMs,
    },
  });

  // Real provider readiness for GET /health (60s cache to avoid hammering APIs).
  let healthCache: { at: number; providers: Record<string, boolean> } | null = null;
  const providerHealth = async (): Promise<Record<string, boolean>> => {
    if (healthCache && Date.now() - healthCache.at < 60_000) return healthCache.providers;
    const [stt, tts, llm] = await Promise.all([
      speechProvider.healthCheck().catch(() => false),
      ttsProvider.healthCheck().catch(() => false),
      llmProvider.healthCheck().catch(() => false),
    ]);
    healthCache = { at: Date.now(), providers: { "sarvam-stt": stt, "sarvam-tts": tts, cerebras: llm } };
    return healthCache.providers;
  };

  const server = new AircoTalksWebSocketServer({
    orchestrator,
    eventBus,
    logger,
    port: config.port,
    allowedOrigins: config.webOrigins,
    providerHealth,
  });

  await server.start();

  const shutdown = async (signal: string) => {
    logger.info("shutting down", { signal });
    await server.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
