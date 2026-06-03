import { telemetryRecordSchema, type TelemetryRecord } from "../telemetry/telemetryRecord";
import type { Logger } from "../../ports/logger";
import type { TelemetryRepository } from "../../ports/telemetryRepository";

export interface ProcessTelemetryBatchResult {
  accepted: number;
  rejected: number;
}

interface ValidationIssue {
  path: PropertyKey[];
  code?: string;
  message: string;
}

interface ValidationIssueLog {
  path: string;
  code: string;
  message: string;
}

function formatIssuePath(path: PropertyKey[]): string {
  return path.length > 0 ? path.map(String).join(".") : "<record>";
}

function formatValidationIssues(issues: ValidationIssue[]): ValidationIssueLog[] {
  return issues.map((issue) => ({
    path: formatIssuePath(issue.path),
    code: issue.code ?? "unknown",
    message: issue.message
  }));
}

function getRecordContext(record: unknown): Record<string, unknown> {
  if (record === null || typeof record !== "object") {
    return {};
  }

  const candidate = record as Record<string, unknown>;
  const context: Record<string, unknown> = {};

  if (typeof candidate.sourceLine === "number") {
    context.sourceLine = candidate.sourceLine;
  }

  if (typeof candidate.droneId === "string" && candidate.droneId.length > 0) {
    context.droneId = candidate.droneId;
  }

  if (typeof candidate.parseError === "string") {
    context.parseError = candidate.parseError;
  }

  return context;
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
        ...getRecordContext(record),
        issues: formatValidationIssues(parsed.error.issues)
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
