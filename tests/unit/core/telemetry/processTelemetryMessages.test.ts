import { processTelemetryMessages } from "../../../../src/core/telemetry/processTelemetryMessages";
import type {
  ProcessedRecord,
  RawMessage,
  RejectedRecord
} from "../../../../src/core/telemetry/telemetryProcessingTypes";
import type { Logger } from "../../../../src/ports/observability/logger";
import type { RejectedTelemetryRepository } from "../../../../src/ports/persistence/rejectedTelemetryRepository";
import type { TelemetryRepository } from "../../../../src/ports/persistence/telemetryRepository";

const fixedNow = new Date("2026-06-04T10:00:00.000Z");

const logger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

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

function validMessage(overrides: Record<string, unknown> = {}): RawMessage {
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
  telemetryRepository = new TestRecordRepository(),
  rejectedTelemetryRepository = new TestRejectedTelemetryRepository()
) {
  return {
    telemetryRepository,
    rejectedTelemetryRepository,
    logger,
    getCurrentTime: () => fixedNow
  };
}

describe("processTelemetryMessages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("processes valid messages into persisted telemetry records", async () => {
    // ARRANGE
    const telemetryRepository = new TestRecordRepository();
    const rejectedTelemetryRepository = new TestRejectedTelemetryRepository();
    const expectedResult = { received: 1, processed: 1, rejected: 0 };
    const expectedProcessedRecords: ProcessedRecord[] = [
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
    ];

    // ACT
    const actualResult = await processTelemetryMessages(
      [validMessage()],
      dependencies(telemetryRepository, rejectedTelemetryRepository)
    );

    // ASSERT
    expect(actualResult).toEqual(expectedResult);
    expect(telemetryRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(telemetryRepository.records).toEqual(expectedProcessedRecords);
    expect(rejectedTelemetryRepository.saveBatch).not.toHaveBeenCalled();
  });

  it("continues processing a mixed batch and persists invalid messages separately", async () => {
    // ARRANGE
    const telemetryRepository = new TestRecordRepository();
    const rejectedTelemetryRepository = new TestRejectedTelemetryRepository();
    const messages: RawMessage[] = [
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
    ];
    const expectedResult = { received: 3, processed: 2, rejected: 1 };
    const expectedProcessedDroneIds = ["drone-001", "drone-003"];
    const expectedValidationErrors = expect.arrayContaining([
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
    ]);

    // ACT
    const actualResult = await processTelemetryMessages(
      messages,
      dependencies(telemetryRepository, rejectedTelemetryRepository)
    );

    // ASSERT
    expect(actualResult).toEqual(expectedResult);
    expect(telemetryRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(telemetryRepository.records.map((record) => record.droneId)).toEqual(
      expectedProcessedDroneIds
    );
    expect(rejectedTelemetryRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(rejectedTelemetryRepository.records).toHaveLength(1);
    expect(rejectedTelemetryRepository.records[0]).toMatchObject({
      messageId: "message-valid",
      reason: "VALIDATION_FAILED",
      rejectedAt: fixedNow.toISOString()
    });
    expect(rejectedTelemetryRepository.records[0]?.errors).toEqual(expectedValidationErrors);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("rejects corrupt JSON without calling the telemetry repository", async () => {
    // ARRANGE
    const telemetryRepository = new TestRecordRepository();
    const rejectedTelemetryRepository = new TestRejectedTelemetryRepository();
    const corruptJsonMessage: RawMessage = {
      messageId: "message-corrupt",
      body: '{"droneId": "drone-001",'
    };
    const expectedResult = { received: 1, processed: 0, rejected: 1 };
    const expectedRejectedRecord = {
      messageId: "message-corrupt",
      body: '{"droneId": "drone-001",',
      reason: "INVALID_JSON",
      rejectedAt: fixedNow.toISOString()
    };
    const expectedJsonError = {
      path: "<body>",
      code: "invalid_json",
      message: expect.any(String)
    };

    // ACT
    const actualResult = await processTelemetryMessages(
      [corruptJsonMessage],
      dependencies(telemetryRepository, rejectedTelemetryRepository)
    );

    // ASSERT
    expect(actualResult).toEqual(expectedResult);
    expect(telemetryRepository.saveBatch).not.toHaveBeenCalled();
    expect(rejectedTelemetryRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(rejectedTelemetryRepository.records[0]).toMatchObject(expectedRejectedRecord);
    expect(rejectedTelemetryRepository.records[0]?.errors[0]).toEqual(expectedJsonError);
  });

  it("does not swallow repository failures (so AWS can retry system errors)", async () => {
    // ARRANGE
    const telemetryRepository = new TestRecordRepository();
    const rejectedTelemetryRepository = new TestRejectedTelemetryRepository();
    const expectedError = "DynamoDB unavailable";

    telemetryRepository.saveBatch.mockRejectedValueOnce(new Error(expectedError));

    // ACT & ASSERT
    await expect(
      processTelemetryMessages([validMessage()], dependencies(telemetryRepository, rejectedTelemetryRepository))
    ).rejects.toThrow(expectedError);

    expect(telemetryRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(rejectedTelemetryRepository.saveBatch).not.toHaveBeenCalled();
  });
});
