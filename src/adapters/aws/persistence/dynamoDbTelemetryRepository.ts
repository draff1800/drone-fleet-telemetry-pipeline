import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

import type { ProcessedRecord } from "../../../core/telemetry/telemetryTypes";
import type { RecordRepository } from "../../../ports/persistence/telemetryRepository";

const telemetryTableNameEnv = "TELEMETRY_TABLE_NAME";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} must be configured`);
  }

  return value;
}

export class DynamoDbTelemetryRepository implements RecordRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor(options: { tableName?: string; client?: DynamoDBDocumentClient } = {}) {
    this.tableName = options.tableName ?? requireEnv(telemetryTableNameEnv);
    this.client = options.client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async saveBatch(records: ProcessedRecord[]): Promise<void> {
    await Promise.all(
      records.map((record) =>
        this.client.send(
          new PutCommand({
            TableName: this.tableName,
            Item: {
              PK: `DRONE#${record.droneId}`,
              SK: `TIMESTAMP#${record.timestamp}#EVENT#${record.recordId}`,
              ...record
            }
          })
        )
      )
    );
  }
}
