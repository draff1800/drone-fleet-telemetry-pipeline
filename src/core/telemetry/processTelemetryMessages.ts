import { telemetryInputSchema, type TelemetryInput } from "./telemetryInputSchema";
import type {
  ProcessedRecord,
  ProcessingSummary,
  RawMessage,
  RejectionError,
  RejectedRecord
} from "./telemetryProcessingTypes";
import type { Logger } from "../../ports/observability/logger";
import type { RejectedTelemetryRepository } from "../../ports/persistence/rejectedTelemetryRepository";
import type { TelemetryRepository } from "../../ports/persistence/telemetryRepository";

export interface TelemetryProcessingDependencies {
  telemetryRepository: TelemetryRepository;
  rejectedTelemetryRepository: RejectedTelemetryRepository;
  getCurrentTime?: () => Date;
  logger: Logger;
}

function formatIssuePath(path: PropertyKey[]): string {
  return path.length > 0 ? path.map(String).join(".") : "<record>";
}

function formatValidationIssues(
  issues: Array<{ path: PropertyKey[]; code?: string; message: string }>
): RejectionError[] {
  return issues.map((issue) => ({
    path: formatIssuePath(issue.path),
    code: issue.code ?? "unknown",
    message: issue.message
  }));
}

function createRecordId(record: TelemetryInput): string {
  return `${record.droneId}#${record.timestamp}#${record.eventType}`;
}

function processTelemetryRecord(record: TelemetryInput, processedAt: string): ProcessedRecord {
  return {
    recordId: createRecordId(record),
    processedAt,
    ...record
  };
}

function createRejectedRecord(
  message: RawMessage,
  reason: RejectedRecord["reason"],
  errors: RejectionError[],
  rejectedAt: string
): RejectedRecord {
  return {
    messageId: message.messageId,
    body: message.body,
    reason,
    errors,
    rejectedAt
  };
}

export async function processTelemetryMessages(
  messages: RawMessage[],
  dependencies: TelemetryProcessingDependencies
): Promise<ProcessingSummary> {
  const processedRecords: ProcessedRecord[] = [];
  const rejectedRecords: RejectedRecord[] = [];

  const currentTime = dependencies.getCurrentTime ?? (() => new Date());

  for (const message of messages) {
    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(message.body);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const rejectedAt = currentTime().toISOString();

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

    const parsedRecord = telemetryInputSchema.safeParse(parsedBody);

    if (!parsedRecord.success) {
      const issues = formatValidationIssues(parsedRecord.error.issues);
      const rejectedAt = currentTime().toISOString();

      rejectedRecords.push(
        createRejectedRecord(message, "VALIDATION_FAILED", issues, rejectedAt)
      );
      dependencies.logger.warn("Rejected invalid telemetry record", {
        messageId: message.messageId,
        issues
      });
      continue;
    }

    processedRecords.push(
      processTelemetryRecord(parsedRecord.data, currentTime().toISOString())
    );
  }

  if (rejectedRecords.length > 0) {
    await dependencies.rejectedTelemetryRepository.saveBatch(rejectedRecords);
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
