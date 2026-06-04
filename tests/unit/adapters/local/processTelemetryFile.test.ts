import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  parseNdjson,
  processTelemetryFile
} from "../../../../src/adapters/local/processTelemetryFile";
import type { Logger } from "../../../../src/ports/observability/logger";

const logger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const tmpRoot = join(process.cwd(), "tests", ".tmp", "process-telemetry-file");

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

describe("processTelemetryFile", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await rm(tmpRoot, { force: true, recursive: true });
    await mkdir(tmpRoot, { recursive: true });
  });

  afterAll(async () => {
    await rm(tmpRoot, { force: true, recursive: true });
  });

  it("parses non-empty NDJSON lines into raw telemetry messages", () => {
    const messages = parseNdjson(`\n${validTelemetryLine()}\r\n  \n{"invalid": true}\n`);

    expect(messages).toEqual([
      {
        messageId: "line-2",
        body: validTelemetryLine()
      },
      {
        messageId: "line-4",
        body: '{"invalid": true}'
      }
    ]);
  });

  it("processes a local NDJSON file and writes rejected records for inspection", async () => {
    const inputPath = join(tmpRoot, "mixed.ndjson");
    const rejectedRecordsPath = join(tmpRoot, "output", "rejected-records.json");

    await writeFile(
      inputPath,
      [
        validTelemetryLine({ droneId: "drone-001" }),
        validTelemetryLine({
          droneId: "drone-002",
          telemetryData: {
            batteryLevel: 101
          }
        }),
        '{"droneId": "drone-003",'
      ].join("\n"),
      "utf8"
    );

    const result = await processTelemetryFile({
      inputPath,
      rejectedRecordsPath,
      logger
    });

    expect(result.summary).toEqual({ received: 3, processed: 1, rejected: 2 });
    expect(result.persistedTelemetryRecords).toBe(1);
    expect(result.persistedRejectedRecords).toBe(2);
    expect(result.rejectedRecordsPath).toBe(rejectedRecordsPath);

    const rejectedRecords = JSON.parse(await readFile(rejectedRecordsPath, "utf8")) as Array<{
      messageId: string;
      reason: string;
    }>;

    expect(rejectedRecords).toEqual([
      expect.objectContaining({
        messageId: "line-2",
        reason: "VALIDATION_FAILED"
      }),
      expect.objectContaining({
        messageId: "line-3",
        reason: "INVALID_JSON"
      })
    ]);
  });
});
