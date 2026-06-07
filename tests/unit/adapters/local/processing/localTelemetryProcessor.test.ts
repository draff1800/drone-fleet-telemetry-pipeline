import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { processTelemetryFile } from "../../../../../src/adapters/local/processing/localTelemetryProcessor";
import type { Logger } from "../../../../../src/ports/observability/logger";

const logger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const tmpRoot = join(process.cwd(), "tests", ".tmp", "local-telemetry-processor");

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

describe("localTelemetryProcessor", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await rm(tmpRoot, { force: true, recursive: true });
    await mkdir(tmpRoot, { recursive: true });
  });

  afterAll(async () => {
    await rm(tmpRoot, { force: true, recursive: true });
  });

  it("processes a local NDJSON file and writes records for inspection", async () => {
    // ARRANGE
    const inputPath = join(tmpRoot, "mixed.ndjson");
    const processedRecordsPath = join(tmpRoot, "output", "processed-records.json");
    const rejectedRecordsPath = join(tmpRoot, "output", "rejected-records.json");
    const expectedSummary = { received: 3, processed: 1, rejected: 2 };
    const expectedProcessedRecords = [
      expect.objectContaining({
        droneId: "drone-001",
        recordId: "drone-001#2026-06-03T20:00:00.000Z#SENSOR_READING"
      })
    ];
    const expectedRejectedRecords = [
      expect.objectContaining({
        messageId: "line-2",
        reason: "VALIDATION_FAILED"
      }),
      expect.objectContaining({
        messageId: "line-3",
        reason: "INVALID_JSON"
      })
    ];

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

    // ACT
    const actualResult = await processTelemetryFile({
      inputPath,
      outputPaths: {
        processedRecords: processedRecordsPath,
        rejectedRecords: rejectedRecordsPath
      },
      logger
    });

    const actualProcessedRecords = JSON.parse(await readFile(processedRecordsPath, "utf8")) as Array<{
      droneId: string;
      recordId: string;
    }>;

    const actualRejectedRecords = JSON.parse(await readFile(rejectedRecordsPath, "utf8")) as Array<{
      messageId: string;
      reason: string;
    }>;

    // ASSERT
    expect(actualResult.summary).toEqual(expectedSummary);
    expect(actualResult.outputPaths.processedRecords).toBe(processedRecordsPath);
    expect(actualResult.outputPaths.rejectedRecords).toBe(rejectedRecordsPath);
    expect(actualResult.records.processed).toHaveLength(1);
    expect(actualResult.records.rejected).toHaveLength(2);
    expect(actualProcessedRecords).toEqual(expectedProcessedRecords);
    expect(actualRejectedRecords).toEqual(expectedRejectedRecords);
  });
});
