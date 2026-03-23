/**
 * logger.ts — structured logging for MotionRoll server-side code.
 *
 * In development: plain console.* calls (no extra dependency needed).
 * In production: outputs JSON lines compatible with log aggregators
 *   (Datadog, Cloudwatch, etc.).
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("Project synced", { projectId, revision });
 *   logger.error("Sync failed", { error: err.message, projectId });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
};

const isDev = process.env.NODE_ENV !== "production";

function writeLog(level: LogLevel, message: string, extra: Record<string, unknown> = {}) {
  if (isDev) {
    // Pretty-print in dev so the terminal stays readable
    const prefix = {
      debug: "[debug]",
      info:  "[info] ",
      warn:  "[warn] ",
      error: "[error]",
    }[level];

    const extras = Object.keys(extra).length > 0 ? " " + JSON.stringify(extra) : "";
    const line = `${prefix} ${message}${extras}`;

    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);

    return;
  }

  // Production: emit JSON line
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  };

  const line = JSON.stringify(entry);

  if (level === "error") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

export const logger = {
  debug(message: string, extra?: Record<string, unknown>) {
    if (!isDev) return; // skip debug in production
    writeLog("debug", message, extra);
  },

  info(message: string, extra?: Record<string, unknown>) {
    writeLog("info", message, extra);
  },

  warn(message: string, extra?: Record<string, unknown>) {
    writeLog("warn", message, extra);
  },

  error(message: string, extra?: Record<string, unknown>) {
    writeLog("error", message, extra);
  },

  /** Wrap a promise and log errors automatically. */
  async wrapAsync<T>(
    label: string,
    fn: () => Promise<T>,
    extra?: Record<string, unknown>,
  ): Promise<T> {
    try {
      const result = await fn();
      return result;
    } catch (err) {
      writeLog("error", label, {
        ...extra,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }
  },
};
