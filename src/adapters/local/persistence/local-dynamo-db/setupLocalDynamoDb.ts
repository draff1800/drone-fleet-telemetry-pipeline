import { structuredConsoleLogger } from "../../../observability/structuredConsoleLogger";
import { createLocalDynamoDbClient, localDynamoDbConfigFromEnv, setupLocalDynamoDbTables } from "./localDynamoDb";

async function main(): Promise<void> {
  const config = localDynamoDbConfigFromEnv();
  const result = await setupLocalDynamoDbTables(createLocalDynamoDbClient(config), config);

  console.log([
    "",
    "Local DynamoDB setup complete:",
    "---",
    `Endpoint: ${config.endpoint}`,
    `Region: ${config.region}`,
    `Telemetry table: ${result.telemetryTableName}`,
    `Rejected Telemetry table: ${result.rejectedTelemetryTableName}`
  ].join("\n"));
}

void main().catch((error: unknown) => {
  console.error();
  structuredConsoleLogger.error("Failed to set up local DynamoDB tables", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
