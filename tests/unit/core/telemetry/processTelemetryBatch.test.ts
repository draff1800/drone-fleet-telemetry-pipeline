import { processTelemetryBatch } from "../../../../src/core/telemetry/processTelemetryBatch";
import type { TelemetryRecord } from "../../../../src/core/telemetry/telemetryRecord";
import type { Logger } from "../../../../src/ports/logger";
import type { TelemetryRepository } from "../../../../src/ports/telemetryRepository";

const logger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

class TestTelemetryRepository implements TelemetryRepository {
  readonly records: TelemetryRecord[] = [];

  async saveBatch(records: TelemetryRecord[]): Promise<void> {
    this.records.push(...records);
  }
}

describe("processTelemetryBatch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores valid telemetry records", async () => {
    const repository = new TestTelemetryRepository();

    const result = await processTelemetryBatch(
      [
        {
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
      ],
      repository,
      logger
    );

    expect(result).toEqual({ accepted: 1, rejected: 0 });
    expect(repository.records).toHaveLength(1);
    expect(repository.records[0]?.eventType).toBe("SENSOR_READING");
  });

  it("stores records with optional battery telemetry", async () => {
    const repository = new TestTelemetryRepository();

    const result = await processTelemetryBatch(
      [
        {
          droneId: "drone-001",
          timestamp: "2026-06-03T20:01:00.000Z",
          eventType: "BATTERY_STATUS",
          statusCode: "WARN",
          telemetryData: {
            batteryLevel: 18
          }
        }
      ],
      repository,
      logger
    );

    expect(result).toEqual({ accepted: 1, rejected: 0 });
    expect(repository.records).toHaveLength(1);
    expect(repository.records[0]?.eventType).toBe("BATTERY_STATUS");
  });

  it("rejects invalid records without failing the whole batch", async () => {
    const repository = new TestTelemetryRepository();

    const result = await processTelemetryBatch(
      [
        {
          droneId: "drone-001",
          timestamp: "2026-06-03T20:00:00.000Z",
          eventType: "SENSOR_READING",
          statusCode: "OK",
          telemetryData: {
            latitude: 54.5973,
            longitude: -5.9301
          }
        },
        {
          sourceLine: 2,
          droneId: "",
          timestamp: "not-a-date",
          eventType: "BATTERY_STATUS",
          statusCode: "",
          telemetryData: {
            batteryLevel: 101
          }
        }
      ],
      repository,
      logger
    );

    expect(result).toEqual({ accepted: 1, rejected: 1 });
    expect(repository.records).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith("Rejected invalid telemetry record", {
      sourceLine: 2,
      issues: [
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
          path: "statusCode",
          code: "invalid_value",
          message: 'Invalid option: expected one of "OK"|"WARN"|"ERROR"'
        },
        {
          path: "telemetryData.batteryLevel",
          code: "too_big",
          message: "Too big: expected number to be <=100"
        }
      ]
    });
  });

  it("rejects out-of-range telemetry data", async () => {
    const repository = new TestTelemetryRepository();

    const result = await processTelemetryBatch(
      [
        {
          droneId: "drone-001",
          timestamp: "2026-06-03T20:01:00.000Z",
          eventType: "SENSOR_READING",
          statusCode: "OK",
          telemetryData: {
            latitude: 91,
            longitude: -181
          }
        }
      ],
      repository,
      logger
    );

    expect(result).toEqual({ accepted: 0, rejected: 1 });
    expect(repository.records).toHaveLength(0);
  });
});
