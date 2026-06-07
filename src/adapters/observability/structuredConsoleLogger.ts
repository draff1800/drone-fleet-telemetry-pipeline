import type { Logger } from "../../ports/observability/logger";

function write(
  level: "info" | "warn" | "error", 
  message: string, 
  context?: Record<string, unknown>
): void {
  const entry = {
    level,
    message,
    ...context
  };

  console.log(JSON.stringify(entry));
}

export const structuredConsoleLogger: Logger = {
  info: (message, context) => write("info", message, context),
  warn: (message, context) => write("warn", message, context),
  error: (message, context) => write("error", message, context)
};
