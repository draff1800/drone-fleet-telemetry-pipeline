import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { DynamoDbRejectedRecordRepository } from "../../../../../src/adapters/aws/persistence/dynamoDbRejectedRecordRepository";
import type { RejectedRecord } from "../../../../../src/core/telemetry/telemetryTypes";

function dynamoClient() {
  return {
    send: jest.fn(async () => ({}))
  } as unknown as DynamoDBDocumentClient & { send: jest.Mock };
}

describe("DynamoDbRejectedRecordRepository", () => {
  const record: RejectedRecord = {
    messageId: "message-invalid",
    body: "{\"droneId\":\"\"}",
    reason: "VALIDATION_FAILED",
    rejectedAt: "2026-06-04T10:00:00.000Z",
    errors: [
      {
        path: "droneId",
        code: "too_small",
        message: "Too small"
      }
    ]
  };

  afterEach(() => {
    delete process.env.REJECTED_TABLE_NAME;
  });

  it("writes each rejected record with the expected DynamoDB keys", async () => {
    const client = dynamoClient();
    const repository = new DynamoDbRejectedRecordRepository({
      tableName: "RejectedTable",
      client
    });

    await repository.saveBatch([record]);

    expect(client.send).toHaveBeenCalledTimes(1);
    expect(client.send.mock.calls[0]?.[0]).toBeInstanceOf(PutCommand);
    expect(client.send.mock.calls[0]?.[0].input).toEqual({
      TableName: "RejectedTable",
      Item: {
        PK: "REJECTION#VALIDATION_FAILED",
        SK: "INGESTED_AT#2026-06-04T10:00:00.000Z#MESSAGE#message-invalid",
        ingestedAt: "2026-06-04T10:00:00.000Z",
        ...record
      }
    });
  });

  it("uses REJECTED_TABLE_NAME when a table name is not provided", async () => {
    process.env.REJECTED_TABLE_NAME = "RejectedFromEnv";
    const client = dynamoClient();
    const repository = new DynamoDbRejectedRecordRepository({ client });

    await repository.saveBatch([record]);

    expect(client.send.mock.calls[0]?.[0].input.TableName).toBe("RejectedFromEnv");
  });

  it("uses a stable key segment when messageId is missing", async () => {
    const client = dynamoClient();
    const repository = new DynamoDbRejectedRecordRepository({
      tableName: "RejectedTable",
      client
    });

    await repository.saveBatch([{ ...record, messageId: undefined }]);

    expect(client.send.mock.calls[0]?.[0].input.Item.SK).toBe(
      "INGESTED_AT#2026-06-04T10:00:00.000Z#MESSAGE#missing-message-id"
    );
  });

  it("fails fast when REJECTED_TABLE_NAME is missing", () => {
    expect(() => new DynamoDbRejectedRecordRepository({ client: dynamoClient() })).toThrow(
      "REJECTED_TABLE_NAME must be configured"
    );
  });
});
