import { processTelemetryBatch } from "../../src/core/telemetry/processTelemetryBatch";
import type { TelemetryRecord } from "../../src/core/telemetry/telemetryRecord";
import type { Logger } from "../../src/ports/logger";
import type { TelemetryRepository } from "../../src/ports/telemetryRepository";

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
          eventType: "location_update",
          statusCode: "OK",
          telemetryData: {
            latitude: 54.5973,
            longitude: -5.9301,
            altitudeMeters: 120
          }
        }
      ],
      repository,
      logger
    );

    expect(result).toEqual({ accepted: 1, rejected: 0 });
    expect(repository.records).toHaveLength(1);
    expect(repository.records[0]?.eventType).toBe("location_update");
  });

  it("stores battery telemetry records", async () => {
    const repository = new TestTelemetryRepository();

    const result = await processTelemetryBatch(
      [
        {
          droneId: "drone-001",
          timestamp: "2026-06-03T20:01:00.000Z",
          eventType: "battery_update",
          statusCode: "LOW_BATTERY",
          telemetryData: {
            batteryPercent: 18
          }
        }
      ],
      repository,
      logger
    );

    expect(result).toEqual({ accepted: 1, rejected: 0 });
    expect(repository.records).toHaveLength(1);
    expect(repository.records[0]?.eventType).toBe("battery_update");
  });

  it("rejects invalid records without failing the whole batch", async () => {
    const repository = new TestTelemetryRepository();

    const result = await processTelemetryBatch(
      [
        {
          droneId: "drone-001",
          timestamp: "2026-06-03T20:00:00.000Z",
          eventType: "location_update",
          statusCode: "OK",
          telemetryData: {
            latitude: 54.5973,
            longitude: -5.9301,
            altitudeMeters: 120
          }
        },
        {
          droneId: "",
          timestamp: "not-a-date",
          eventType: "battery_update",
          statusCode: "",
          telemetryData: {
            batteryPercent: 101
          }
        }
      ],
      repository,
      logger
    );

    expect(result).toEqual({ accepted: 1, rejected: 1 });
    expect(repository.records).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("rejects telemetry data that does not match the event type", async () => {
    const repository = new TestTelemetryRepository();

    const result = await processTelemetryBatch(
      [
        {
          droneId: "drone-001",
          timestamp: "2026-06-03T20:01:00.000Z",
          eventType: "battery_update",
          statusCode: "OK",
          telemetryData: {
            latitude: 54.5973,
            longitude: -5.9301,
            altitudeMeters: 120
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
