import { consoleLogger } from "./observability/consoleLogger";
import { processTelemetryFileToDynamoDb } from "./processTelemetryFileToDynamoDb";

async function main(): Promise<void> {
  const result = await processTelemetryFileToDynamoDb({
    inputPath: process.argv[2] ?? "samples/telemetry-mixed.ndjson",
    logger: consoleLogger
  });

  console.log([
    "",
    "Telemetry Processing Summary:",
    "---",
    `Input: ${result.inputPath}`,
    `Received: ${result.summary.received}`,
    `Processed: ${result.summary.processed}`,
    `Rejected: ${result.summary.rejected}`,
    `Output (processed records): Local DynamoDB table - ${result.tables.telemetry}`,
    `Output (rejected records): Local DynamoDB table - ${result.tables.rejected}`
  ].join("\n"));
}

void main().catch((error: unknown) => {
  console.error();
  consoleLogger.error("Failed to process telemetry file with DynamoDB Local", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
