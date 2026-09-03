import { AppError } from "@dhvani/shared";

/** Microphone/browser-side permission issues (surfaced to client). */
export class MicrophonePermissionError extends AppError {
  constructor(message = "Microphone permission denied") {
    super("MICROPHONE_PERMISSION_DENIED", message, { recoverable: true });
  }
}

export class SpeechProviderError extends AppError {
  constructor(message: string, options?: { cause?: unknown; recoverable?: boolean }) {
    super("SPEECH_PROVIDER_ERROR", message, { provider: "sarvam-stt", recoverable: options?.recoverable ?? true, cause: options?.cause });
  }
}

export class LLMProviderError extends AppError {
  constructor(message: string, options?: { cause?: unknown; recoverable?: boolean }) {
    super("LLM_PROVIDER_ERROR", message, { provider: "cerebras-llm", recoverable: options?.recoverable ?? true, cause: options?.cause });
  }
}

export class TTSProviderError extends AppError {
  constructor(message: string, options?: { cause?: unknown; recoverable?: boolean }) {
    super("TTS_PROVIDER_ERROR", message, { provider: "sarvam-tts", recoverable: options?.recoverable ?? true, cause: options?.cause });
  }
}

export class WebSocketError extends AppError {
  constructor(message: string, options?: { cause?: unknown; recoverable?: boolean }) {
    super("WEBSOCKET_ERROR", message, { recoverable: options?.recoverable ?? true, cause: options?.cause });
  }
}

export class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, { recoverable: true, metadata });
  }
}
