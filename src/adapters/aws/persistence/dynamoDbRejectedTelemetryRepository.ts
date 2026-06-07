import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

import type { RejectedRecord } from "../../../core/telemetry/telemetryProcessingTypes";
import type { RejectedTelemetryRepository } from "../../../ports/persistence/rejectedTelemetryRepository";
import { requireEnv } from "../config/requireEnv";

const defaultTableNameEnvKey = "REJECTED_TELEMETRY_TABLE_NAME";
const defaultMessageId = "missing-message-id";

export class DynamoDbRejectedTelemetryRepository implements RejectedTelemetryRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor(options: { tableName?: string; client?: DynamoDBDocumentClient } = {}) {
    this.tableName = options.tableName ?? requireEnv(defaultTableNameEnvKey);
    this.client = options.client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async saveBatch(records: RejectedRecord[]): Promise<void> {
    await Promise.all(
      records.map((record) => {
        const ingestedAt = record.rejectedAt;
        const messageId = record.messageId ?? defaultMessageId;

        return this.client.send(
          new PutCommand({
            TableName: this.tableName,
            Item: {
              PK: `REJECTION#${record.reason}`,
              SK: `INGESTED_AT#${ingestedAt}#MESSAGE#${messageId}`,
              ingestedAt,
              ...record
            }
          })
        );
      })
    );
  }
}
