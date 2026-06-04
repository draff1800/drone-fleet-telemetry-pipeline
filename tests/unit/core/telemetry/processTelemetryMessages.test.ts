import { processTelemetryMessages } from "../../../../src/core/telemetry/processTelemetryMessages";
import type {
  ProcessedTelemetryRecord,
  RawTelemetryMessage,
  RejectedTelemetryRecord
} from "../../../../src/core/telemetry/telemetryTypes";
import type { Logger } from "../../../../src/ports/observability/logger";
import type { RejectedRecordRepository } from "../../../../src/ports/persistence/rejectedRecordRepository";
import type { TelemetryRepository } from "../../../../src/ports/persistence/telemetryRepository";

const fixedNow = new Date("2026-06-04T10:00:00.000Z");

const logger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

class TestTelemetryRepository implements TelemetryRepository {
  readonly records: ProcessedTelemetryRecord[] = [];
  readonly saveBatch = jest.fn(async (records: ProcessedTelemetryRecord[]): Promise<void> => {
    this.records.push(...records);
  });
}

class TestRejectedRecordRepository implements RejectedRecordRepository {
  readonly records: RejectedTelemetryRecord[] = [];
  readonly saveBatch = jest.fn(async (records: RejectedTelemetryRecord[]): Promise<void> => {
    this.records.push(...records);
  });
}

function validMessage(overrides: Record<string, unknown> = {}): RawTelemetryMessage {
  return {
    messageId: "message-valid",
    body: JSON.stringify({
      droneId: "drone-001",
      timestamp: "2026-06-03T20:00:00.000Z",
      eventType: "SENSOR_READING",
      statusCode: "OK",
      telemetryData: {
        latitude: 54.5973,
        longitude: -5.9301,
        altitudeMeters: 120,
        temperatureCelsius: 12.4
      },
      ...overrides
    })
  };
}

function dependencies(
  telemetryRepository = new TestTelemetryRepository(),
  rejectedRecordRepository = new TestRejectedRecordRepository()
) {
  return {
    telemetryRepository,
    rejectedRecordRepository,
    logger,
    now: () => fixedNow
  };
}

describe("processTelemetryMessages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("processes valid messages into persisted telemetry records", async () => {
    const telemetryRepository = new TestTelemetryRepository();
    const rejectedRecordRepository = new TestRejectedRecordRepository();

    const result = await processTelemetryMessages(
      [validMessage()],
      dependencies(telemetryRepository, rejectedRecordRepository)
    );

    expect(result).toEqual({ received: 1, processed: 1, rejected: 0 });
    expect(telemetryRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(telemetryRepository.records).toEqual([
      {
        recordId: "drone-001#2026-06-03T20:00:00.000Z#SENSOR_READING",
        processedAt: fixedNow.toISOString(),
        droneId: "drone-001",
        timestamp: "2026-06-03T20:00:00.000Z",
        eventType: "SENSOR_READING",
        statusCode: "OK",
        telemetryData: {
          latitude: 54.5973,
          longitude: -5.9301,
          altitudeMeters: 120,
          temperatureCelsius: 12.4
        }
      }
    ]);
    expect(rejectedRecordRepository.saveBatch).not.toHaveBeenCalled();
  });

  it("continues processing a mixed batch and persists invalid messages separately", async () => {
    const telemetryRepository = new TestTelemetryRepository();
    const rejectedRecordRepository = new TestRejectedRecordRepository();

    const result = await processTelemetryMessages(
      [
        validMessage({ droneId: "drone-001" }),
        validMessage({
          droneId: "",
          timestamp: "not-a-date",
          telemetryData: {
            batteryLevel: 101
          }
        }),
        validMessage({
          droneId: "drone-003",
          eventType: "BATTERY_STATUS",
          statusCode: "WARN",
          telemetryData: {
            batteryLevel: 18
          }
        })
      ],
      dependencies(telemetryRepository, rejectedRecordRepository)
    );

    expect(result).toEqual({ received: 3, processed: 2, rejected: 1 });
    expect(telemetryRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(telemetryRepository.records.map((record) => record.droneId)).toEqual([
      "drone-001",
      "drone-003"
    ]);
    expect(rejectedRecordRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(rejectedRecordRepository.records).toHaveLength(1);
    expect(rejectedRecordRepository.records[0]).toMatchObject({
      messageId: "message-valid",
      reason: "VALIDATION_FAILED",
      rejectedAt: fixedNow.toISOString()
    });
    expect(rejectedRecordRepository.records[0]?.errors).toEqual(
      expect.arrayContaining([
        {
          path: "droneId",
          code: "too_small",
          message: "Too small: expected string to have >=1 characters"
        },
        {
          path: "timestamp",
          code: "invalid_format",
          message: "Invalid ISO datetime"
        },
        {
          path: "telemetryData.batteryLevel",
          code: "too_big",
          message: "Too big: expected number to be <=100"
        }
      ])
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("rejects corrupt JSON without calling the telemetry repository", async () => {
    const telemetryRepository = new TestTelemetryRepository();
    const rejectedRecordRepository = new TestRejectedRecordRepository();

    const result = await processTelemetryMessages(
      [
        {
          messageId: "message-corrupt",
          body: '{"droneId": "drone-001",'
        }
      ],
      dependencies(telemetryRepository, rejectedRecordRepository)
    );

    expect(result).toEqual({ received: 1, processed: 0, rejected: 1 });
    expect(telemetryRepository.saveBatch).not.toHaveBeenCalled();
    expect(rejectedRecordRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(rejectedRecordRepository.records[0]).toMatchObject({
      messageId: "message-corrupt",
      body: '{"droneId": "drone-001",',
      reason: "INVALID_JSON",
      rejectedAt: fixedNow.toISOString()
    });
    expect(rejectedRecordRepository.records[0]?.errors[0]).toEqual({
      path: "<body>",
      code: "invalid_json",
      message: expect.any(String)
    });
  });

  it("does not swallow repository failures so AWS can retry system errors", async () => {
    const telemetryRepository = new TestTelemetryRepository();
    const rejectedRecordRepository = new TestRejectedRecordRepository();
    telemetryRepository.saveBatch.mockRejectedValueOnce(new Error("DynamoDB unavailable"));

    await expect(
      processTelemetryMessages([validMessage()], dependencies(telemetryRepository, rejectedRecordRepository))
    ).rejects.toThrow("DynamoDB unavailable");

    expect(telemetryRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(rejectedRecordRepository.saveBatch).not.toHaveBeenCalled();
  });
});
