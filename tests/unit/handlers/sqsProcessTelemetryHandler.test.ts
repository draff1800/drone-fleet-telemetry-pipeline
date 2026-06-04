import {
  createSqsProcessTelemetryHandler,
  mapSqsRecordToRawTelemetryMessage,
  type SqsEvent
} from "../../../src/handlers/sqsProcessTelemetryHandler";
import type {
  ProcessedRecord,
  RejectedRecord
} from "../../../src/core/telemetry/telemetryTypes";
import type { Logger } from "../../../src/ports/observability/logger";
import type { RejectedRecordRepository } from "../../../src/ports/persistence/rejectedRecordRepository";
import type { RecordRepository } from "../../../src/ports/persistence/telemetryRepository";

class TestRecordRepository implements RecordRepository {
  readonly records: ProcessedRecord[] = [];
  readonly saveBatch = jest.fn(async (records: ProcessedRecord[]): Promise<void> => {
    this.records.push(...records);
  });
}

class TestRejectedRecordRepository implements RejectedRecordRepository {
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

function sqsEvent(body: string, messageId = "message-1"): SqsEvent {
  return {
    Records: [
      {
        messageId,
        body
      }
    ]
  };
}

function validBody(overrides: Record<string, unknown> = {}): string {
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

describe("sqsProcessTelemetryHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps an SQS record to a raw telemetry message", () => {
    expect(
      mapSqsRecordToRawTelemetryMessage({
        messageId: "message-123",
        body: "{\"droneId\":\"drone-001\"}"
      })
    ).toEqual({
      messageId: "message-123",
      body: "{\"droneId\":\"drone-001\"}"
    });
  });

  it("processes SQS records with DynamoDB-backed dependencies and logs a structured summary", async () => {
    const telemetryRepository = new TestRecordRepository();
    const rejectedRecordRepository = new TestRejectedRecordRepository();
    const testLogger = logger();
    const handler = createSqsProcessTelemetryHandler(() => ({
      telemetryRepository,
      rejectedRecordRepository,
      logger: testLogger
    }));

    const summary = await handler(sqsEvent(validBody()));

    expect(summary).toEqual({ received: 1, processed: 1, rejected: 0 });
    expect(telemetryRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(rejectedRecordRepository.saveBatch).not.toHaveBeenCalled();
    expect(testLogger.info).toHaveBeenCalledWith("Processed SQS telemetry batch", {
      source: "sqs",
      received: 1,
      processed: 1,
      rejected: 0
    });
  });

  it("does not throw for validation failures so invalid records do not retry forever", async () => {
    const telemetryRepository = new TestRecordRepository();
    const rejectedRecordRepository = new TestRejectedRecordRepository();
    const testLogger = logger();
    const handler = createSqsProcessTelemetryHandler(() => ({
      telemetryRepository,
      rejectedRecordRepository,
      logger: testLogger
    }));

    const summary = await handler(sqsEvent(validBody({ droneId: "" }), "message-invalid"));

    expect(summary).toEqual({ received: 1, processed: 0, rejected: 1 });
    expect(telemetryRepository.saveBatch).not.toHaveBeenCalled();
    expect(rejectedRecordRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(rejectedRecordRepository.records[0]).toMatchObject({
      messageId: "message-invalid",
      reason: "VALIDATION_FAILED"
    });
    expect(testLogger.error).not.toHaveBeenCalled();
  });

  it("rethrows persistence failures so SQS can retry system errors", async () => {
    const telemetryRepository = new TestRecordRepository();
    const rejectedRecordRepository = new TestRejectedRecordRepository();
    const testLogger = logger();
    const failure = new Error("DynamoDB unavailable");
    telemetryRepository.saveBatch.mockRejectedValueOnce(failure);
    const handler = createSqsProcessTelemetryHandler(() => ({
      telemetryRepository,
      rejectedRecordRepository,
      logger: testLogger
    }));

    await expect(handler(sqsEvent(validBody()))).rejects.toThrow("DynamoDB unavailable");

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
});
