/**
 * Base application error. Typed errors in the server extend this so callers can
 * branch on `code` and know whether an error is recoverable. Generic
 * `new Error(...)` is avoided throughout the codebase.
 */
export interface AppErrorOptions {
  cause?: unknown;
  recoverable?: boolean;
  /** Provider that failed, e.g. "sarvam-stt", "cerebras-llm". */
  provider?: string;
  metadata?: Record<string, unknown>;
}

export class AppError extends Error {
  readonly code: string;
  readonly recoverable: boolean;
  readonly provider?: string;
  readonly metadata?: Record<string, unknown>;

  constructor(code: string, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.recoverable = options.recoverable ?? true;
    this.provider = options.provider;
    this.metadata = options.metadata;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }

  toJSON(): { code: string; message: string; recoverable: boolean; provider?: string } {
    return {
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      provider: this.provider,
    };
  }
}
