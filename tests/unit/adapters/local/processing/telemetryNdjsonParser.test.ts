import { parseTelemetryNdjson } from "../../../../../src/adapters/local/processing/telemetryNdjsonParser";

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

describe("telemetryNdjsonParser", () => {
  it("parses non-empty NDJSON lines into raw telemetry messages", () => {
    // ARRANGE
    const ndjson = `\n${validTelemetryLine()}\r\n  \n{"invalid": true}\n`;
    const expectedResult = [
      {
        messageId: "line-2",
        body: validTelemetryLine()
      },
      {
        messageId: "line-4",
        body: '{"invalid": true}'
      }
    ];

    // ACT
    const actualResult = parseTelemetryNdjson(ndjson);

    // ASSERT
    expect(actualResult).toEqual(expectedResult);
  });
});
