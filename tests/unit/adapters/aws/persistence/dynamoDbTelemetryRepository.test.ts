import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { DynamoDbTelemetryRepository } from "../../../../../src/adapters/aws/persistence/dynamoDbTelemetryRepository";
import type { ProcessedRecord } from "../../../../../src/core/telemetry/telemetryProcessingTypes";

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
    // ARRANGE
    const client = dynamoClient();
    const repository = new DynamoDbTelemetryRepository({
      tableName: "example-telemetry-table",
      client
    });
    const expectedResult = {
      TableName: "example-telemetry-table",
      Item: {
        PK: "DRONE#drone-001",
        SK: "TIMESTAMP#2026-06-03T20:00:00.000Z#EVENT#drone-001#2026-06-03T20:00:00.000Z#SENSOR_READING",
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

  it("uses TELEMETRY_TABLE_NAME when a table name is not provided", async () => {
    // ARRANGE
    process.env.TELEMETRY_TABLE_NAME = "example-telemetry-table";
    const client = dynamoClient();
    const repository = new DynamoDbTelemetryRepository({ client });
    const expectedResult = "example-telemetry-table";

    // ACT
    await repository.saveBatch([record]);
    const actualResult = client.send.mock.calls[0]?.[0].input.TableName;

    // ASSERT
    expect(actualResult).toBe(expectedResult);
  });
});
