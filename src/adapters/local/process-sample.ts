import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { processTelemetryBatch } from "../../core/telemetry/processTelemetryBatch";
import { consoleLogger } from "../../observability/consoleLogger";
import { InMemoryTelemetryRepository } from "./inMemoryTelemetryRepository";

async function main(): Promise<void> {
  const samplePath = resolve(process.cwd(), "samples", "telemetry.json");
  const raw = await readFile(samplePath, "utf8");
  const records: unknown = JSON.parse(raw);

  if (!Array.isArray(records)) {
    throw new Error("Sample telemetry file must contain a JSON array.");
  }

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
