import {
  CreateTableCommand,
  type CreateTableCommandInput,
  DynamoDBClient,
  waitUntilTableExists
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

export interface LocalDynamoDbConfig {
  endpoint: string;
  region: string;
  telemetryTableName: string;
  rejectedTelemetryTableName: string;
}

export const defaultLocalDynamoDbConfig: LocalDynamoDbConfig = {
  endpoint: "http://localhost:8000",
  region: "eu-west-1",
  telemetryTableName: "drone-telemetry",
  rejectedTelemetryTableName: "rejected-drone-telemetry"
};

export function localDynamoDbConfigFromEnv(): LocalDynamoDbConfig {
  return {
    endpoint: process.env.LOCAL_DYNAMODB_ENDPOINT ?? defaultLocalDynamoDbConfig.endpoint,
    region: process.env.AWS_REGION ?? defaultLocalDynamoDbConfig.region,
    telemetryTableName:
      process.env.LOCAL_TELEMETRY_TABLE_NAME ?? defaultLocalDynamoDbConfig.telemetryTableName,
    rejectedTelemetryTableName:
      process.env.LOCAL_REJECTED_TELEMETRY_TABLE_NAME ?? defaultLocalDynamoDbConfig.rejectedTelemetryTableName
  };
}

export function createLocalDynamoDbClient(
  config: LocalDynamoDbConfig = localDynamoDbConfigFromEnv()
): DynamoDBClient {
  return new DynamoDBClient({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: "local",
      secretAccessKey: "local"
    }
  });
}

export function createLocalDynamoDbDocumentClient(
  config: LocalDynamoDbConfig = localDynamoDbConfigFromEnv()
): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(createLocalDynamoDbClient(config));
}

export function telemetryTableDefinition(tableName: string): CreateTableCommandInput {
  return {
    TableName: tableName,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      {
        AttributeName: "PK",
        AttributeType: "S"
      },
      {
        AttributeName: "SK",
        AttributeType: "S"
      },
      {
        AttributeName: "eventType",
        AttributeType: "S"
      },
      {
        AttributeName: "timestamp",
        AttributeType: "S"
      }
    ],
    KeySchema: [
      {
        AttributeName: "PK",
        KeyType: "HASH"
      },
      {
        AttributeName: "SK",
        KeyType: "RANGE"
      }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "EventTypeTimeIndex",
        KeySchema: [
          {
            AttributeName: "eventType",
            KeyType: "HASH"
          },
          {
            AttributeName: "timestamp",
            KeyType: "RANGE"
          }
        ],
        Projection: {
          ProjectionType: "ALL"
        }
      }
    ]
  };
}

export function rejectedTelemetryTableDefinition(tableName: string): CreateTableCommandInput {
  return {
    TableName: tableName,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      {
        AttributeName: "PK",
        AttributeType: "S"
      },
      {
        AttributeName: "SK",
        AttributeType: "S"
      }
    ],
    KeySchema: [
      {
        AttributeName: "PK",
        KeyType: "HASH"
      },
      {
        AttributeName: "SK",
        KeyType: "RANGE"
      }
    ]
  };
}

async function ensureTableExists(
  client: DynamoDBClient,
  tableDefinition: CreateTableCommandInput
): Promise<void> {
  if (!tableDefinition.TableName) {
    throw new Error("Local DynamoDB table definition must include a table name");
  }

  try {
    await client.send(new CreateTableCommand(tableDefinition));
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "ResourceInUseException") {
      return;
    }

    throw error;
  }

  await waitUntilTableExists(
    {
      client,
      maxWaitTime: 20,
      minDelay: 1,
      maxDelay: 2
    },
    {
      TableName: tableDefinition.TableName
    }
  );
}

export async function setupLocalDynamoDbTables(
  client: DynamoDBClient = createLocalDynamoDbClient(),
  config: LocalDynamoDbConfig = localDynamoDbConfigFromEnv()
): Promise<{ telemetryTableName: string; rejectedTelemetryTableName: string }> {
  await ensureTableExists(client, telemetryTableDefinition(config.telemetryTableName));
  await ensureTableExists(client, rejectedTelemetryTableDefinition(config.rejectedTelemetryTableName));

  return {
    telemetryTableName: config.telemetryTableName,
    rejectedTelemetryTableName: config.rejectedTelemetryTableName
  };
}

export async function countLocalDynamoDbTableItems(
  client: DynamoDBDocumentClient,
  tableName: string
): Promise<number> {
  const response = await client.send(
    new ScanCommand({
      TableName: tableName,
      Select: "COUNT"
    })
  );

  return response.Count ?? 0;
}
