import { telemetryInputSchema } from "../../../../src/core/telemetry/telemetryInputSchema";

describe("telemetryInputSchema", () => {
  it("accepts a valid telemetry record", () => {
    // ARRANGE
    const validTelemetryInput = {
      droneId: "drone-003",
      timestamp: "2026-06-03T20:02:00.000Z",
      eventType: "DELIVERY_COMPLETED",
      statusCode: "OK",
      telemetryData: {
        packageId: "pkg-123",
        latitude: 51.5072,
        longitude: -0.1276,
        batteryLevel: 72
      }
    };
    const expectedResult = true;

    // ACT
    const actualResult = telemetryInputSchema.safeParse(validTelemetryInput).success;

    // ASSERT
    expect(actualResult).toBe(expectedResult);
  });

  it.each([
    [
      "empty drone id",
      {
        droneId: "",
        timestamp: "2026-06-03T20:02:00.000Z",
        eventType: "DELIVERY_COMPLETED",
        statusCode: "OK",
        telemetryData: {}
      }
    ],
    [
      "invalid timestamp",
      {
        droneId: "drone-003",
        timestamp: "June 3 2026",
        eventType: "DELIVERY_COMPLETED",
        statusCode: "OK",
        telemetryData: {}
      }
    ],
    [
      "invalid event type",
      {
        droneId: "drone-003",
        timestamp: "2026-06-03T20:02:00.000Z",
        eventType: "LOCATION_UPDATE",
        statusCode: "OK",
        telemetryData: {}
      }
    ],
    [
      "invalid status code",
      {
        droneId: "drone-003",
        timestamp: "2026-06-03T20:02:00.000Z",
        eventType: "ERROR",
        statusCode: "LOW_BATTERY",
        telemetryData: {}
      }
    ],
    [
      "invalid telemetry object",
      {
        droneId: "drone-003",
        timestamp: "2026-06-03T20:02:00.000Z",
        eventType: "ERROR",
        statusCode: "ERROR",
        telemetryData: []
      }
    ],
    [
      "invalid battery level",
      {
        droneId: "drone-003",
        timestamp: "2026-06-03T20:02:00.000Z",
        eventType: "BATTERY_STATUS",
        statusCode: "WARN",
        telemetryData: {
          batteryLevel: -1
        }
      }
    ],
    [
      "invalid latitude",
      {
        droneId: "drone-003",
        timestamp: "2026-06-03T20:02:00.000Z",
        eventType: "SENSOR_READING",
        statusCode: "OK",
        telemetryData: {
          latitude: -91
        }
      }
    ],
    [
      "invalid longitude",
      {
        droneId: "drone-003",
        timestamp: "2026-06-03T20:02:00.000Z",
        eventType: "SENSOR_READING",
        statusCode: "OK",
        telemetryData: {
          longitude: 181
        }
      }
    ]
  ])("rejects %s", (_description, invalidTelemetryInput) => {
    // ARRANGE
    const expectedResult = false;

    // ACT
    const actualResult = telemetryInputSchema.safeParse(invalidTelemetryInput).success;

    // ASSERT
    expect(actualResult).toBe(expectedResult);
  });
});
