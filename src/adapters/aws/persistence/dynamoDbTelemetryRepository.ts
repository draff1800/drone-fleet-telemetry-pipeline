import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

import type { ProcessedRecord } from "../../../core/telemetry/telemetryProcessingTypes";
import type { TelemetryRepository } from "../../../ports/persistence/telemetryRepository";
import { requireEnv } from "../config/requireEnv";

const defaultTableNameEnvKey = "TELEMETRY_TABLE_NAME";

export class DynamoDbTelemetryRepository implements TelemetryRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor(options: { tableName?: string; client?: DynamoDBDocumentClient } = {}) {
    this.tableName = options.tableName ?? requireEnv(defaultTableNameEnvKey);
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
