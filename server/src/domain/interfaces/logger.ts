export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  sessionId?: string;
  requestId?: string;
  event?: string;
  [key: string]: unknown;
}

/**
 * Structured logger contract. Implementations must never log API keys, tokens,
 * or raw audio. The application/domain layers depend on this interface, not a
 * concrete logger.
 */
export interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}
