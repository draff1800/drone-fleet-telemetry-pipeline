import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { processTelemetryBatch } from "../../core/telemetry/processTelemetryBatch";
import { consoleLogger } from "../../observability/consoleLogger";
import { InMemoryTelemetryRepository } from "./inMemoryTelemetryRepository";

function parseNdjson(raw: string): unknown[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      const sourceLine = index + 1;

      try {
        const record: unknown = JSON.parse(line);

        if (record !== null && typeof record === "object" && !Array.isArray(record)) {
          return {
            sourceLine,
            ...record
          };
        }

        return {
          sourceLine,
          value: record
        };
      } catch (error: unknown) {
        return {
          sourceLine,
          parseError: error instanceof Error ? error.message : String(error),
          rawLine: line
        };
      }
    });
}

async function main(): Promise<void> {
  const samplePath = resolve(process.cwd(), process.argv[2] ?? "samples/telemetry-mixed.ndjson");
  const raw = await readFile(samplePath, "utf8");
  const records = parseNdjson(raw);

  const repository = new InMemoryTelemetryRepository();
  const result = await processTelemetryBatch(records, repository, consoleLogger);

  consoleLogger.info("Processed sample telemetry", {
    ...result,
    stored: repository.all().length
  });
}

void main().catch((error: unknown) => {
  consoleLogger.error("Failed to process sample telemetry", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
