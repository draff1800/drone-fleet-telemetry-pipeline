import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { DynamoDbRejectedTelemetryRepository } from "../../../../../src/adapters/aws/persistence/dynamoDbRejectedTelemetryRepository";
import type { RejectedRecord } from "../../../../../src/core/telemetry/telemetryProcessingTypes";

function dynamoClient() {
  return {
    send: jest.fn(async () => ({}))
  } as unknown as DynamoDBDocumentClient & { send: jest.Mock };
}

describe("DynamoDbRejectedTelemetryRepository", () => {
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
    delete process.env.REJECTED_TELEMETRY_TABLE_NAME;
  });

  it("writes each rejected record with the expected DynamoDB keys", async () => {
    // ARRANGE
    const client = dynamoClient();
    const repository = new DynamoDbRejectedTelemetryRepository({
      tableName: "RejectedTable",
      client
    });
    const expectedResult = {
      TableName: "RejectedTable",
      Item: {
        PK: "REJECTION#VALIDATION_FAILED",
        SK: "INGESTED_AT#2026-06-04T10:00:00.000Z#MESSAGE#message-invalid",
        ingestedAt: "2026-06-04T10:00:00.000Z",
        ...record
      }
    };

    // ACT
    await repository.saveBatch([record]);
    const actualResult = client.send.mock.calls[0]?.[0];

    // ASSERT
    expect(client.send).toHaveBeenCalledTimes(1);
    expect(actualResult).toBeInstanceOf(PutCommand);
    expect(actualResult.input).toEqual(expectedResult);
  });

  it("uses REJECTED_TELEMETRY_TABLE_NAME when a table name is not provided", async () => {
    // ARRANGE
    process.env.REJECTED_TELEMETRY_TABLE_NAME = "RejectedFromEnv";
    const client = dynamoClient();
    const repository = new DynamoDbRejectedTelemetryRepository({ client });
    const expectedResult = "RejectedFromEnv";

    // ACT
    await repository.saveBatch([record]);
    const actualResult = client.send.mock.calls[0]?.[0].input.TableName;

    // ASSERT
    expect(actualResult).toBe(expectedResult);
  });

  it("uses a stable key segment when messageId is missing", async () => {
    // ARRANGE
    const client = dynamoClient();
    const repository = new DynamoDbRejectedTelemetryRepository({
      tableName: "RejectedTable",
      client
    });
    const expectedResult = "INGESTED_AT#2026-06-04T10:00:00.000Z#MESSAGE#missing-message-id";

    // ACT
    await repository.saveBatch([{ ...record, messageId: undefined }]);
    const actualResult = client.send.mock.calls[0]?.[0].input.Item.SK;

    // ASSERT
    expect(actualResult).toBe(expectedResult);
  });
});
