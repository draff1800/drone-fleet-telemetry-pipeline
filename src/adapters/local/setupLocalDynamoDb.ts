import { createLocalDynamoDbClient, localDynamoDbConfigFromEnv, setupLocalDynamoDbTables } from "./dynamoDbLocal";
import { consoleLogger } from "./observability/consoleLogger";

async function main(): Promise<void> {
  const config = localDynamoDbConfigFromEnv();
  const result = await setupLocalDynamoDbTables(createLocalDynamoDbClient(config), config);

  console.log([
    "",
    "DynamoDB Local setup complete:",
    "---",
    `Endpoint: ${config.endpoint}`,
    `Region: ${config.region}`,
    `Telemetry table: ${result.telemetryTableName}`,
    `Rejected records table: ${result.rejectedTableName}`
  ].join("\n"));
}

void main().catch((error: unknown) => {
  console.error();
  consoleLogger.error("Failed to set up DynamoDB Local tables", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
