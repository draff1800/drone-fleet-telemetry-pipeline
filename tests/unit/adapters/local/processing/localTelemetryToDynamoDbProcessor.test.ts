import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { processTelemetryFileToDynamoDb } from "../../../../../src/adapters/local/processing/localTelemetryToDynamoDbProcessor";
import type { Logger } from "../../../../../src/ports/observability/logger";

const mockDbDocumentClient = { send: jest.fn() };
const mockTelemetryRepositoryInstances: Array<{ saveBatch: jest.Mock }> = [];
const mockRejectedTelemetryRepositoryInstances: Array<{ saveBatch: jest.Mock }> = [];

jest.mock("../../../../../src/adapters/local/persistence/local-dynamo-db/localDynamoDb", () => ({
  countLocalDynamoDbTableItems: jest.fn(async (_client: unknown, tableName: string) =>
    tableName === "TelemetryTable" ? 1 : 2
  ),
  createLocalDynamoDbDocumentClient: jest.fn(() => mockDbDocumentClient),
  localDynamoDbConfigFromEnv: jest.fn(() => ({
    endpoint: "http://localhost:8000",
    region: "eu-west-1",
    telemetryTableName: "TelemetryTable",
    rejectedTelemetryTableName: "RejectedTelemetryTable"
  }))
}));

jest.mock("../../../../../src/adapters/aws/persistence/dynamoDbTelemetryRepository", () => ({
  DynamoDbTelemetryRepository: jest.fn().mockImplementation(() => {
    const repository = {
      saveBatch: jest.fn(async () => undefined)
    };
    mockTelemetryRepositoryInstances.push(repository);
    return repository;
  })
}));

jest.mock("../../../../../src/adapters/aws/persistence/dynamoDbRejectedTelemetryRepository", () => ({
  DynamoDbRejectedTelemetryRepository: jest.fn().mockImplementation(() => {
    const repository = {
      saveBatch: jest.fn(async () => undefined)
    };
    mockRejectedTelemetryRepositoryInstances.push(repository);
    return repository;
  })
}));

import {
  countLocalDynamoDbTableItems,
  createLocalDynamoDbDocumentClient
} from "../../../../../src/adapters/local/persistence/local-dynamo-db/localDynamoDb";
import { DynamoDbRejectedTelemetryRepository } from "../../../../../src/adapters/aws/persistence/dynamoDbRejectedTelemetryRepository";
import { DynamoDbTelemetryRepository } from "../../../../../src/adapters/aws/persistence/dynamoDbTelemetryRepository";

const logger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const tmpRoot = join(process.cwd(), "tests", ".tmp", "local-telemetry-to-dynamodb-processor");

function validTelemetryLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    droneId: "drone-001",
    timestamp: "2026-06-03T20:00:00.000Z",
    eventType: "SENSOR_READING",
    statusCode: "OK",
    telemetryData: {
      latitude: 54.5973,
      longitude: -5.9301
    },
    ...overrides
  });
}

describe("localTelemetryToDynamoDbProcessor", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockDbDocumentClient.send.mockClear();
    mockTelemetryRepositoryInstances.length = 0;
    mockRejectedTelemetryRepositoryInstances.length = 0;
    await rm(tmpRoot, { force: true, recursive: true });
    await mkdir(tmpRoot, { recursive: true });
  });

  afterAll(async () => {
    await rm(tmpRoot, { force: true, recursive: true });
  });

  it("processes a local NDJSON file through DynamoDB repositories using local table config", async () => {
    const inputPath = join(tmpRoot, "mixed.ndjson");

    await writeFile(
      inputPath,
      [
        validTelemetryLine({ droneId: "drone-001" }),
        validTelemetryLine({
          droneId: "",
          telemetryData: {
            batteryLevel: 101
          }
        }),
        '{"droneId": "drone-003",'
      ].join("\n"),
      "utf8"
    );

    const result = await processTelemetryFileToDynamoDb({
      inputPath,
      dbConfig: {
        endpoint: "http://localhost:8000",
        region: "eu-west-1",
        telemetryTableName: "TelemetryTable",
        rejectedTelemetryTableName: "RejectedTelemetryTable"
      },
      logger
    });

    expect(createLocalDynamoDbDocumentClient).toHaveBeenCalledWith({
      endpoint: "http://localhost:8000",
      region: "eu-west-1",
      telemetryTableName: "TelemetryTable",
      rejectedTelemetryTableName: "RejectedTelemetryTable"
    });
    expect(DynamoDbTelemetryRepository).toHaveBeenCalledWith({
      tableName: "TelemetryTable",
      client: mockDbDocumentClient
    });
    expect(DynamoDbRejectedTelemetryRepository).toHaveBeenCalledWith({
      tableName: "RejectedTelemetryTable",
      client: mockDbDocumentClient
    });
    expect(mockTelemetryRepositoryInstances[0]?.saveBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        droneId: "drone-001",
        recordId: "drone-001#2026-06-03T20:00:00.000Z#SENSOR_READING"
      })
    ]);
    expect(mockRejectedTelemetryRepositoryInstances[0]?.saveBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        messageId: "line-2",
        reason: "VALIDATION_FAILED"
      }),
      expect.objectContaining({
        messageId: "line-3",
        reason: "INVALID_JSON"
      })
    ]);
    expect(countLocalDynamoDbTableItems).toHaveBeenCalledWith(mockDbDocumentClient, "TelemetryTable");
    expect(countLocalDynamoDbTableItems).toHaveBeenCalledWith(
      mockDbDocumentClient,
      "RejectedTelemetryTable"
    );
    expect(result).toEqual({
      inputPath,
      summary: {
        received: 3,
        processed: 1,
        rejected: 2
      },
      storedCounts: {
        telemetry: 1,
        rejected: 2
      },
      tables: {
        telemetry: "TelemetryTable",
        rejected: "RejectedTelemetryTable"
      }
    });
  });
});
