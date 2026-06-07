import { structuredConsoleLogger } from "../../observability/structuredConsoleLogger";
import { processTelemetryFile } from "../processing/localTelemetryProcessor";

async function main(): Promise<void> {
  const result = await processTelemetryFile({
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
    `Output (processed records): ${result.outputPaths.processedRecords}`,
    `Output (rejected records): ${result.outputPaths.rejectedRecords}`
  ].join("\n"));
}

void main().catch((error: unknown) => {
  console.error();
  structuredConsoleLogger.error("Failed to process telemetry locally", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
