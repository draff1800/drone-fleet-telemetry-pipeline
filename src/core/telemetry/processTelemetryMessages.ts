import { telemetryRecordSchema, type TelemetryRecord } from "./telemetryInput";
import type {
  ProcessedTelemetryRecord,
  ProcessingSummary,
  RawTelemetryMessage,
  RejectedTelemetryError,
  RejectedTelemetryRecord
} from "./telemetryTypes";
import type { Logger } from "../../ports/logger";
import type {
  RejectedRecordRepository,
  TelemetryRepository
} from "../../ports/telemetryRepository";

export interface ProcessTelemetryDependencies {
  telemetryRepository: TelemetryRepository;
  rejectedRecordRepository: RejectedRecordRepository;
  logger: Logger;
  now?: () => Date;
}

function formatIssuePath(path: PropertyKey[]): string {
  return path.length > 0 ? path.map(String).join(".") : "<record>";
}

function formatValidationIssues(
  issues: Array<{ path: PropertyKey[]; code?: string; message: string }>
): RejectedTelemetryError[] {
  return issues.map((issue) => ({
    path: formatIssuePath(issue.path),
    code: issue.code ?? "unknown",
    message: issue.message
  }));
}

function createRecordId(record: TelemetryRecord): string {
  return `${record.droneId}#${record.timestamp}#${record.eventType}`;
}

function transformTelemetryRecord(record: TelemetryRecord, processedAt: string): ProcessedTelemetryRecord {
  return {
    recordId: createRecordId(record),
    processedAt,
    ...record
  };
}

function createRejectedRecord(
  message: RawTelemetryMessage,
  reason: RejectedTelemetryRecord["reason"],
  errors: RejectedTelemetryError[],
  rejectedAt: string
): RejectedTelemetryRecord {
  return {
    messageId: message.messageId,
    body: message.body,
    reason,
    errors,
    rejectedAt
  };
}

export async function processTelemetryMessages(
  messages: RawTelemetryMessage[],
  dependencies: ProcessTelemetryDependencies
): Promise<ProcessingSummary> {
  const processedRecords: ProcessedTelemetryRecord[] = [];
  const rejectedRecords: RejectedTelemetryRecord[] = [];
  const now = dependencies.now ?? (() => new Date());

  for (const message of messages) {
    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(message.body);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const rejectedAt = now().toISOString();

      rejectedRecords.push(
        createRejectedRecord(
          message,
          "INVALID_JSON",
          [
            {
              path: "<body>",
              code: "invalid_json",
              message: errorMessage
            }
          ],
          rejectedAt
        )
      );
      dependencies.logger.warn("Rejected telemetry message with invalid JSON", {
        messageId: message.messageId,
        error: errorMessage
      });
      continue;
    }

    const parsedRecord = telemetryRecordSchema.safeParse(parsedBody);

    if (!parsedRecord.success) {
      const issues = formatValidationIssues(parsedRecord.error.issues);
      const rejectedAt = now().toISOString();

      rejectedRecords.push(
        createRejectedRecord(message, "VALIDATION_FAILED", issues, rejectedAt)
      );
      dependencies.logger.warn("Rejected invalid telemetry record", {
        messageId: message.messageId,
        issues
      });
      continue;
    }

    processedRecords.push(transformTelemetryRecord(parsedRecord.data, now().toISOString()));
  }

  if (rejectedRecords.length > 0) {
    await dependencies.rejectedRecordRepository.saveBatch(rejectedRecords);
  }

  if (processedRecords.length > 0) {
    await dependencies.telemetryRepository.saveBatch(processedRecords);
  }

  return {
    received: messages.length,
    processed: processedRecords.length,
    rejected: rejectedRecords.length
  };
}
