import { DynamoDbRejectedRecordRepository } from "../adapters/aws/persistence/dynamoDbRejectedRecordRepository";
import { DynamoDbTelemetryRepository } from "../adapters/aws/persistence/dynamoDbTelemetryRepository";
import { consoleLogger } from "../adapters/local/observability/consoleLogger";
import { processTelemetryMessages } from "../core/telemetry/processTelemetryMessages";
import type { ProcessingSummary, RawMessage } from "../core/telemetry/telemetryTypes";
import type { Logger } from "../ports/observability/logger";
import type { RejectedRecordRepository } from "../ports/persistence/rejectedRecordRepository";
import type { RecordRepository } from "../ports/persistence/telemetryRepository";

export interface SqsRecord {
  messageId: string;
  body: string;
}

export interface SqsEvent {
  Records: SqsRecord[];
}

export type RawTelemetryMessage = RawMessage;

export interface SqsProcessorDependencies {
  telemetryRepository: RecordRepository;
  rejectedRecordRepository: RejectedRecordRepository;
  logger: Logger;
}

type DependencyFactory = () => SqsProcessorDependencies;

function createDefaultDependencies(): SqsProcessorDependencies {
  return {
    telemetryRepository: new DynamoDbTelemetryRepository(),
    rejectedRecordRepository: new DynamoDbRejectedRecordRepository(),
    logger: consoleLogger
  };
}

function errorContext(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack
    };
  }

  return {
    errorMessage: String(error)
  };
}

export function mapSqsRecordToRawTelemetryMessage(record: SqsRecord): RawTelemetryMessage {
  return {
    messageId: record.messageId,
    body: record.body
  };
}

export function createSqsProcessTelemetryHandler(
  createDependencies: DependencyFactory = createDefaultDependencies
) {
  return async function sqsProcessTelemetryHandler(event: SqsEvent): Promise<ProcessingSummary> {
    const messages = event.Records.map(mapSqsRecordToRawTelemetryMessage);
    let logger = consoleLogger;

    try {
      const dependencies = createDependencies();
      logger = dependencies.logger;

      const summary = await processTelemetryMessages(messages, dependencies);

      logger.info("Processed SQS telemetry batch", {
        source: "sqs",
        ...summary
      });

      return summary;
    } catch (error: unknown) {
      logger.error("Failed to process SQS telemetry batch", {
        source: "sqs",
        received: messages.length,
        ...errorContext(error)
      });
      throw error;
    }
  };
}

export const handler = createSqsProcessTelemetryHandler();
