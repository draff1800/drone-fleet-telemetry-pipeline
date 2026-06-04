import { consoleLogger } from "./observability/consoleLogger";
import { processTelemetryFile } from "./processTelemetryFile";

async function main(): Promise<void> {
  const result = await processTelemetryFile({
    inputPath: process.argv[2] ?? "samples/mixed-telemetry.ndjson",
    logger: consoleLogger
  });

  consoleLogger.info("Processed telemetry file locally", {
    inputPath: result.inputPath,
    rejectedRecordsPath: result.rejectedRecordsPath,
    ...result.summary,
    persistedTelemetryRecords: result.persistedTelemetryRecords,
    persistedRejectedRecords: result.persistedRejectedRecords
  });

  console.log([
    "Telemetry processing summary",
    `Input: ${result.inputPath}`,
    `Received: ${result.summary.received}`,
    `Processed: ${result.summary.processed}`,
    `Rejected: ${result.summary.rejected}`,
    `Output (Rejected records): ${result.rejectedRecordsPath}`
  ].join("\n"));
}

void main().catch((error: unknown) => {
  consoleLogger.error("Failed to process telemetry file locally", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
