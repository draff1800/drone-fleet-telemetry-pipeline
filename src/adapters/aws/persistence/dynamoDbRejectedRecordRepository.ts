import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

import type { RejectedRecord } from "../../../core/telemetry/telemetryTypes";
import type { RejectedRecordRepository } from "../../../ports/persistence/rejectedRecordRepository";

const rejectedTableNameEnv = "REJECTED_TABLE_NAME";
const missingMessageId = "missing-message-id";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} must be configured`);
  }

  return value;
}

export class DynamoDbRejectedRecordRepository implements RejectedRecordRepository {
  private readonly tableName: string;
  private readonly client: DynamoDBDocumentClient;

  constructor(options: { tableName?: string; client?: DynamoDBDocumentClient } = {}) {
    this.tableName = options.tableName ?? requireEnv(rejectedTableNameEnv);
    this.client = options.client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async saveBatch(records: RejectedRecord[]): Promise<void> {
    await Promise.all(
      records.map((record) => {
        const ingestedAt = record.rejectedAt;
        const messageId = record.messageId ?? missingMessageId;

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
