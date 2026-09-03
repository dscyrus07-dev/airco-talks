import type { ILogger, LogLevel, LogContext } from "../../domain/interfaces/logger.js";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Structured console logger. Serializes context to JSON but scrubs keys that
 * look like secrets so API keys/tokens are never logged even by accident.
 */
export class ConsoleLogger implements ILogger {
  constructor(private readonly minLevel: LogLevel = "info") {}

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }
  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }
  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }
  error(message: string, context?: LogContext): void {
    this.log("error", message, context);
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    const ts = new Date().toISOString();
    const safe = context ? scrub(context) : undefined;
    const line = safe ? `${ts} [${level.toUpperCase()}] ${message} ${JSON.stringify(safe)}` : `${ts} [${level.toUpperCase()}] ${message}`;
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(line);
  }
}

const SENSITIVE_KEY = /key|token|secret|password|authorization|apikey/i;

function scrub(context: LogContext): LogContext {
  const out: LogContext = {};
  for (const [k, v] of Object.entries(context)) {
    out[k] = SENSITIVE_KEY.test(k) ? "[REDACTED]" : v;
  }
  return out;
}
