import {
  createTelemetrySqsHandler,
  type SqsBatchEvent
} from "../../../../../src/adapters/aws/handlers/telemetrySqsHandler";
import type {
  ProcessedRecord,
  RejectedRecord
} from "../../../../../src/core/telemetry/telemetryProcessingTypes";
import type { Logger } from "../../../../../src/ports/observability/logger";
import type { RejectedTelemetryRepository } from "../../../../../src/ports/persistence/rejectedTelemetryRepository";
import type { TelemetryRepository } from "../../../../../src/ports/persistence/telemetryRepository";

class TestRecordRepository implements TelemetryRepository {
  readonly records: ProcessedRecord[] = [];
  readonly saveBatch = jest.fn(async (records: ProcessedRecord[]): Promise<void> => {
    this.records.push(...records);
  });
}

class TestRejectedTelemetryRepository implements RejectedTelemetryRepository {
  readonly records: RejectedRecord[] = [];
  readonly saveBatch = jest.fn(async (records: RejectedRecord[]): Promise<void> => {
    this.records.push(...records);
  });
}

function logger(): Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

function sqsEvent(body: string, messageId = "message-1"): SqsBatchEvent {
  return {
    Records: [
      {
        messageId,
        body
      }
    ]
  };
}

function validSqsRecordBody(overrides: Record<string, unknown> = {}): string {
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

describe("telemetrySqsHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handler processes SQS records and logs a structured summary", async () => {
    // ARRANGE
    const telemetryRepository = new TestRecordRepository();
    const rejectedTelemetryRepository = new TestRejectedTelemetryRepository();
    const testLogger = logger();
    const handler = createTelemetrySqsHandler(() => ({
      telemetryRepository,
      rejectedTelemetryRepository,
      logger: testLogger
    }));
    const expectedResult = { received: 1, processed: 1, rejected: 0 };

    // ACT
    const actualResult = await handler(
      sqsEvent(validSqsRecordBody())
    );

    // ASSERT
    expect(actualResult).toEqual(expectedResult);
    expect(telemetryRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(rejectedTelemetryRepository.saveBatch).not.toHaveBeenCalled();
    expect(testLogger.info).toHaveBeenCalledWith("Processed SQS telemetry batch", {
      source: "sqs",
      received: 1,
      processed: 1,
      rejected: 0
    });
  });

  it("handler does not throw for validation failures", async () => {
    // ARRANGE
    const telemetryRepository = new TestRecordRepository();
    const rejectedTelemetryRepository = new TestRejectedTelemetryRepository();
    const testLogger = logger();
    const handler = createTelemetrySqsHandler(() => ({
      telemetryRepository,
      rejectedTelemetryRepository,
      logger: testLogger
    }));
    const expectedResult = { received: 1, processed: 0, rejected: 1 };
    const expectedRejectedRecord = {
      messageId: "message-invalid",
      reason: "VALIDATION_FAILED"
    };

    // ACT
    const actualResult = await handler(
      sqsEvent(validSqsRecordBody({ droneId: "" }), "message-invalid")
    );

    // ASSERT
    expect(actualResult).toEqual(expectedResult);
    expect(telemetryRepository.saveBatch).not.toHaveBeenCalled();
    expect(rejectedTelemetryRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(rejectedTelemetryRepository.records[0]).toMatchObject(expectedRejectedRecord);
    expect(testLogger.error).not.toHaveBeenCalled();
  });

  it("handler rethrows persistence failures so SQS can retry system errors", async () => {
    // ARRANGE
    const telemetryRepository = new TestRecordRepository();
    const rejectedTelemetryRepository = new TestRejectedTelemetryRepository();
    const testLogger = logger();

    const failure = new Error("DynamoDB unavailable");
    telemetryRepository.saveBatch.mockRejectedValueOnce(failure);
    
    const handler = createTelemetrySqsHandler(() => ({
      telemetryRepository,
      rejectedTelemetryRepository,
      logger: testLogger
    }));

    const expectedErrorMessage = "DynamoDB unavailable";

    // ACT
    const actualResult = handler(
      sqsEvent(validSqsRecordBody())
    );

    // ASSERT
    await expect(actualResult).rejects.toThrow(expectedErrorMessage);
    expect(testLogger.error).toHaveBeenCalledWith(
      "Failed to process SQS telemetry batch",
      expect.objectContaining({
        source: "sqs",
        received: 1,
        errorName: "Error",
        errorMessage: "DynamoDB unavailable"
      })
    );
  });

  it("handler rethrows rejected telemetry persistence failures so SQS can retry system errors", async () => {
    // ARRANGE
    const telemetryRepository = new TestRecordRepository();
    const rejectedTelemetryRepository = new TestRejectedTelemetryRepository();
    const testLogger = logger();

    const failure = new Error("Rejected telemetry table unavailable");
    rejectedTelemetryRepository.saveBatch.mockRejectedValueOnce(failure);

    const handler = createTelemetrySqsHandler(() => ({
      telemetryRepository,
      rejectedTelemetryRepository,
      logger: testLogger
    }));
    
    const expectedErrorMessage = "Rejected telemetry table unavailable";

    // ACT
    const actualResult = handler(sqsEvent(validSqsRecordBody({ droneId: "" }), "message-invalid"));

    // ASSERT
    await expect(actualResult).rejects.toThrow(expectedErrorMessage);
    expect(telemetryRepository.saveBatch).not.toHaveBeenCalled();
    expect(rejectedTelemetryRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(testLogger.error).toHaveBeenCalledWith(
      "Failed to process SQS telemetry batch",
      expect.objectContaining({
        source: "sqs",
        received: 1,
        errorName: "Error",
        errorMessage: "Rejected telemetry table unavailable"
      })
    );
  });
});
