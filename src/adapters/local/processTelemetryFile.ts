import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { processTelemetryMessages } from "../../core/telemetry/processTelemetryMessages";
import type {
  ProcessedRecord,
  ProcessingSummary,
  RawMessage,
  RejectedRecord
} from "../../core/telemetry/telemetryTypes";
import type { Logger } from "../../ports/observability/logger";
import { InMemoryRejectedRecordRepository } from "./persistence/inMemoryRejectedRecordRepository";
import { InMemoryRecordRepository } from "./persistence/inMemoryTelemetryRepository";

export interface ProcessTelemetryFileResult {
  inputPath: string;
  summary: ProcessingSummary;
  outputPaths: {
    processedRecords: string;
    rejectedRecords: string;
  };
  records: {
    processed: ProcessedRecord[];
    rejected: RejectedRecord[];
  };
}

export interface ProcessTelemetryFileOptions {
  inputPath: string;
  outputPaths?: {
    processedRecords?: string;
    rejectedRecords?: string;
  };
  logger: Logger;
}

export function parseNdjson(ndjson: string): RawMessage[] {
  return ndjson
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

async function writeJsonFile(path: string, records: unknown[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

export async function processTelemetryFile(
  options: ProcessTelemetryFileOptions
): Promise<ProcessTelemetryFileResult> {
  const inputPath = resolve(process.cwd(), options.inputPath);
  const processedOutputPath = resolve(
    process.cwd(),
    options.outputPaths?.processedRecords ?? "output/processed-records.json"
  );
  const rejectedOutputPath = resolve(
    process.cwd(),
    options.outputPaths?.rejectedRecords ?? "output/rejected-records.json"
  );
  const rawInput = await readFile(inputPath, "utf8");
  const inputMessages = parseNdjson(rawInput);

  const recordRepository = new InMemoryRecordRepository();
  const rejectedRecordRepository = new InMemoryRejectedRecordRepository();

  const summary = await processTelemetryMessages(inputMessages, {
    telemetryRepository: recordRepository,
    rejectedRecordRepository,
    logger: options.logger
  });

  const processedRecords = recordRepository.all();
  const rejectedRecords = rejectedRecordRepository.all();

  await writeJsonFile(processedOutputPath, processedRecords);
  await writeJsonFile(rejectedOutputPath, rejectedRecords);

  return {
    inputPath,
    summary,
    outputPaths: {
      processedRecords: processedOutputPath,
      rejectedRecords: rejectedOutputPath
    },
    records: {
      processed: processedRecords,
      rejected: rejectedRecords
    }
  };
}
