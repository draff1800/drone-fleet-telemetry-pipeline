import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { processTelemetryMessages } from "../../core/telemetry/processTelemetryMessages";
import type { RawTelemetryMessage } from "../../core/telemetry/telemetryTypes";
import { consoleLogger } from "../../observability/consoleLogger";
import {
  InMemoryRejectedRecordRepository,
  InMemoryTelemetryRepository
} from "./inMemoryTelemetryRepository";

function parseNdjson(raw: string): RawTelemetryMessage[] {
  return raw
    .split(/\r?\n/)
    .map((body) => body.trim())
    .filter((body) => body.length > 0)
    .map((body, index) => ({
      messageId: `sample-line-${index + 1}`,
      body
    }));
}

async function main(): Promise<void> {
  const samplePath = resolve(process.cwd(), process.argv[2] ?? "samples/telemetry-mixed.ndjson");
  const raw = await readFile(samplePath, "utf8");
  const records = parseNdjson(raw);

  const repository = new InMemoryTelemetryRepository();
  const rejectedRecordRepository = new InMemoryRejectedRecordRepository();
  const result = await processTelemetryMessages(records, {
    telemetryRepository: repository,
    rejectedRecordRepository,
    logger: consoleLogger
  });

  consoleLogger.info("Processed sample telemetry", {
    ...result,
    persistedTelemetryRecords: repository.all().length,
    persistedRejectedRecords: rejectedRecordRepository.all().length
  });
}

void main().catch((error: unknown) => {
  consoleLogger.error("Failed to process sample telemetry", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
