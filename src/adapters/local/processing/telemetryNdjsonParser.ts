import type { RawMessage } from "../../../core/telemetry/telemetryProcessingTypes";

export function parseTelemetryNdjson(ndjson: string): RawMessage[] {
  return ndjson
    .split(/\r?\n/)
    .map((line, index) => ({
      body: line.trim(),
      lineNumber: index + 1
    }))
    .filter((line) => line.body.length > 0)
    .map((line) => ({
      messageId: `line-${line.lineNumber}`,
      body: line.body
    }));
}
