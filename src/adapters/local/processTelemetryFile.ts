import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { processTelemetryMessages } from "../../core/telemetry/processTelemetryMessages";
import type {
  ProcessingSummary,
  RawTelemetryMessage,
  RejectedTelemetryRecord
} from "../../core/telemetry/telemetryTypes";
import type { Logger } from "../../ports/observability/logger";
import { InMemoryRejectedRecordRepository } from "./persistence/inMemoryRejectedRecordRepository";
import { InMemoryTelemetryRepository } from "./persistence/inMemoryTelemetryRepository";

export interface ProcessTelemetryFileResult {
  inputPath: string;
  rejectedRecordsPath: string;
  summary: ProcessingSummary;
  persistedTelemetryRecords: number;
  persistedRejectedRecords: number;
  rejectedRecords: RejectedTelemetryRecord[];
}

export interface ProcessTelemetryFileOptions {
  inputPath: string;
  rejectedRecordsPath?: string;
  logger: Logger;
}

export function parseNdjson(raw: string): RawTelemetryMessage[] {
  return raw
    .split(/\r?\n/)
    .map((line, index) => ({
      body: line.trim(),
      lineNumber: index + 1
    }))
    .filter((line) => line.body.length > 0)
    .map((line) => ({
      messageId: `line-${line.lineNumber}`,
      body: line.body
    }));
}

export async function processTelemetryFile(
  options: ProcessTelemetryFileOptions
): Promise<ProcessTelemetryFileResult> {
  const inputPath = resolve(process.cwd(), options.inputPath);
  const rejectedRecordsPath = resolve(
    process.cwd(),
    options.rejectedRecordsPath ?? "output/rejected-records.json"
  );
  const raw = await readFile(inputPath, "utf8");
  const messages = parseNdjson(raw);

  const telemetryRepository = new InMemoryTelemetryRepository();
  const rejectedRecordRepository = new InMemoryRejectedRecordRepository();

  const summary = await processTelemetryMessages(messages, {
    telemetryRepository,
    rejectedRecordRepository,
    logger: options.logger
  });

  const rejectedRecords = rejectedRecordRepository.all();

  await mkdir(dirname(rejectedRecordsPath), { recursive: true });
  await writeFile(
    rejectedRecordsPath,
    `${JSON.stringify(rejectedRecords, null, 2)}\n`,
    "utf8"
  );

  return {
    inputPath,
    rejectedRecordsPath,
    summary,
    persistedTelemetryRecords: telemetryRepository.all().length,
    persistedRejectedRecords: rejectedRecords.length,
    rejectedRecords
  };
}
