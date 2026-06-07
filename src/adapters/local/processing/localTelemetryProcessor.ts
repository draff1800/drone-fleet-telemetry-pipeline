import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { processTelemetryMessages } from "../../../core/telemetry/processTelemetryMessages";
import type {
  ProcessedRecord,
  ProcessingSummary,
  RejectedRecord
} from "../../../core/telemetry/telemetryProcessingTypes";
import type { Logger } from "../../../ports/observability/logger";
import { InMemoryRejectedTelemetryRepository } from "../persistence/in-memory/inMemoryRejectedTelemetryRepository";
import { InMemoryTelemetryRepository } from "../persistence/in-memory/inMemoryTelemetryRepository";
import { parseTelemetryNdjson } from "./telemetryNdjsonParser";

export interface LocalTelemetryProcessingResult {
  inputPath: string;
  summary: ProcessingSummary;
  records: {
    processed: ProcessedRecord[];
    rejected: RejectedRecord[];
  };
  outputPaths: {
    processedRecords: string;
    rejectedRecords: string;
  };
}

export interface LocalTelemetryProcessingOptions {
  inputPath: string;
  outputPaths?: {
    processedRecords?: string;
    rejectedRecords?: string;
  };
  logger: Logger;
}

async function writeJsonFile(path: string, records: unknown[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

export async function processTelemetryFile(
  options: LocalTelemetryProcessingOptions
): Promise<LocalTelemetryProcessingResult> {
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
  const inputMessages = parseTelemetryNdjson(rawInput);

  const telemetryRepository = new InMemoryTelemetryRepository();
  const rejectedTelemetryRepository = new InMemoryRejectedTelemetryRepository();

  const summary = await processTelemetryMessages(inputMessages, {
    telemetryRepository: telemetryRepository,
    rejectedTelemetryRepository: rejectedTelemetryRepository,
    logger: options.logger
  });

  const processedRecords = telemetryRepository.all();
  const rejectedRecords = rejectedTelemetryRepository.all();

  await writeJsonFile(processedOutputPath, processedRecords);
  await writeJsonFile(rejectedOutputPath, rejectedRecords);

  return {
    inputPath,
    summary,
    records: {
      processed: processedRecords,
      rejected: rejectedRecords
    },
    outputPaths: {
      processedRecords: processedOutputPath,
      rejectedRecords: rejectedOutputPath
    }
  };
}
