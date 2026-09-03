import { AppError, type LanguageCode } from "@dhvani/shared";

export interface ServerConfig {
  port: number;
  webOrigin: string;
  logLevel: "debug" | "info" | "warn" | "error";
  sarvam: { apiKey: string; baseUrl: string };
  cerebras: { apiKey: string; baseUrl: string; model: string };
  defaultAutoLanguage: LanguageCode;
  confidenceThreshold: number;
  maxContextMessages: number;
  sampleRate: number;
  ttsVoice: string;
}

/**
 * Centralizes all configuration access. Environment variables are validated
 * once at startup so the rest of the app never touches `process.env` directly
 * and missing secrets fail fast with a clear message.
 */
export class ConfigService {
  readonly config: ServerConfig;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const sarvamApiKey = requireEnv(env, "SARVAM_API_KEY");
    const cerebrasApiKey = requireEnv(env, "CEREBRAS_API_KEY");

    this.config = {
      port: intEnv(env, "PORT", 8080),
      webOrigin: env.WEB_ORIGIN ?? "http://localhost:3000",
      logLevel: (env.LOG_LEVEL as ServerConfig["logLevel"]) ?? "info",
      sarvam: { apiKey: sarvamApiKey, baseUrl: "https://api.sarvam.ai" },
      cerebras: {
        apiKey: cerebrasApiKey,
        baseUrl: "https://api.cerebras.ai/v1",
        model: env.CEREBRAS_MODEL ?? "gpt-oss-120b",
      },
      defaultAutoLanguage: normalizeLanguage(env.DEFAULT_AUTO_LANGUAGE ?? "hi-IN"),
      confidenceThreshold: floatEnv(env, "LANGUAGE_CONFIDENCE_THRESHOLD", 0.6),
      maxContextMessages: intEnv(env, "MAX_CONTEXT_MESSAGES", 12),
      sampleRate: intEnv(env, "STT_SAMPLE_RATE", 16000),
      ttsVoice: env.TTS_VOICE ?? "",
    };
  }
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value || value.trim().length === 0) {
    throw new AppError(
      "MISSING_ENV_VAR",
      `Missing required environment variable: ${key}. Copy .env.example to .env and fill in real values.`,
      { recoverable: false, metadata: { key } },
    );
  }
  return value.trim();
}

function intEnv(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function floatEnv(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeLanguage(input: string): LanguageCode {
  const base = input.toLowerCase().split(/[-_]/)[0] ?? "hi";
  const allowed: LanguageCode[] = ["mr", "hi", "en", "gu", "ta", "te", "kn", "ml", "bn", "pa"];
  return (allowed as string[]).includes(base) ? (base as LanguageCode) : "hi";
}
