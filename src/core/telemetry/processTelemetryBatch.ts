import { telemetryRecordSchema, type TelemetryRecord } from "../telemetry/telemetryRecord";
import type { Logger } from "../../ports/logger";
import type { TelemetryRepository } from "../../ports/telemetryRepository";

export interface ProcessTelemetryBatchResult {
  accepted: number;
  rejected: number;
}

export async function processTelemetryBatch(
  records: unknown[],
  repository: TelemetryRepository,
  logger: Logger
): Promise<ProcessTelemetryBatchResult> {
  const validRecords: TelemetryRecord[] = [];
  let rejected = 0;

  for (const record of records) {
    const parsed = telemetryRecordSchema.safeParse(record);

    if (!parsed.success) {
      rejected += 1;
      logger.warn("Rejected invalid telemetry record", {
        issues: parsed.error.issues
      });
      continue;
    }

    validRecords.push(parsed.data);
  }

  if (validRecords.length > 0) {
    await repository.saveBatch(validRecords);
  }

  return {
    accepted: validRecords.length,
    rejected
  };
}
