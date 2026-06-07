import { structuredConsoleLogger } from "../../observability/structuredConsoleLogger";
import { processTelemetryFileToDynamoDb } from "../processing/localTelemetryToDynamoDbProcessor";

async function main(): Promise<void> {
  const result = await processTelemetryFileToDynamoDb({
    inputPath: process.argv[2] ?? "samples/telemetry-mixed.ndjson",
    logger: structuredConsoleLogger
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
  structuredConsoleLogger.error("Failed to process telemetry locally (to DynamoDB)", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
