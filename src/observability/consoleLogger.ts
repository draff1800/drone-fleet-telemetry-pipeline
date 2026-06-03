import type { Logger } from "../ports/logger";

function write(level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>): void {
  const entry = {
    level,
    message,
    ...context
  };

  console[level](JSON.stringify(entry));
}

export const consoleLogger: Logger = {
  info: (message, context) => write("info", message, context),
  warn: (message, context) => write("warn", message, context),
  error: (message, context) => write("error", message, context)
};
