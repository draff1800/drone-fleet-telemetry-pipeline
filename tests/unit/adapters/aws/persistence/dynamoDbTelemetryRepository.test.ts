import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { DynamoDbTelemetryRepository } from "../../../../../src/adapters/aws/persistence/dynamoDbTelemetryRepository";
import type { ProcessedRecord } from "../../../../../src/core/telemetry/telemetryTypes";

function dynamoClient() {
  return {
    send: jest.fn(async () => ({}))
  } as unknown as DynamoDBDocumentClient & { send: jest.Mock };
}

describe("DynamoDbTelemetryRepository", () => {
  const record: ProcessedRecord = {
    recordId: "drone-001#2026-06-03T20:00:00.000Z#SENSOR_READING",
    processedAt: "2026-06-04T10:00:00.000Z",
    droneId: "drone-001",
    timestamp: "2026-06-03T20:00:00.000Z",
    eventType: "SENSOR_READING",
    statusCode: "OK",
    telemetryData: {
      latitude: 54.5973,
      longitude: -5.9301
    }
  };

  afterEach(() => {
    delete process.env.TELEMETRY_TABLE_NAME;
  });

  it("writes each telemetry record with the expected DynamoDB keys", async () => {
    const client = dynamoClient();
    const repository = new DynamoDbTelemetryRepository({
      tableName: "TelemetryTable",
      client
    });

    await repository.saveBatch([record]);

    expect(client.send).toHaveBeenCalledTimes(1);
    expect(client.send.mock.calls[0]?.[0]).toBeInstanceOf(PutCommand);
    expect(client.send.mock.calls[0]?.[0].input).toEqual({
      TableName: "TelemetryTable",
      Item: {
        PK: "DRONE#drone-001",
        SK: "TIMESTAMP#2026-06-03T20:00:00.000Z#EVENT#drone-001#2026-06-03T20:00:00.000Z#SENSOR_READING",
        ...record
      }
    });
  });

  it("uses TELEMETRY_TABLE_NAME when a table name is not provided", async () => {
    process.env.TELEMETRY_TABLE_NAME = "TelemetryFromEnv";
    const client = dynamoClient();
    const repository = new DynamoDbTelemetryRepository({ client });

    await repository.saveBatch([record]);

    expect(client.send.mock.calls[0]?.[0].input.TableName).toBe("TelemetryFromEnv");
  });

  it("fails fast when TELEMETRY_TABLE_NAME is missing", () => {
    expect(() => new DynamoDbTelemetryRepository({ client: dynamoClient() })).toThrow(
      "TELEMETRY_TABLE_NAME must be configured"
    );
  });
});
