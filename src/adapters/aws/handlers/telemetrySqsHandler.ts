import { errorContext } from "../../observability/errorContext";
import { structuredConsoleLogger } from "../../observability/structuredConsoleLogger";
import { processTelemetryMessages } from "../../../core/telemetry/processTelemetryMessages";
import type { ProcessingSummary, RawMessage } from "../../../core/telemetry/telemetryProcessingTypes";
import type { Logger } from "../../../ports/observability/logger";
import type { RejectedTelemetryRepository } from "../../../ports/persistence/rejectedTelemetryRepository";
import type { TelemetryRepository } from "../../../ports/persistence/telemetryRepository";
import { DynamoDbRejectedTelemetryRepository } from "../persistence/dynamoDbRejectedTelemetryRepository";
import { DynamoDbTelemetryRepository } from "../persistence/dynamoDbTelemetryRepository";

export interface SqsRecord {
  messageId: string;
  body: string;
}

export interface SqsBatchEvent {
  Records: SqsRecord[];
}

export interface SqsProcessorDependencies {
  telemetryRepository: TelemetryRepository;
  rejectedTelemetryRepository: RejectedTelemetryRepository;
  logger: Logger;
}

type DependencyFactory = () => SqsProcessorDependencies;

function createDefaultDependencies(): SqsProcessorDependencies {
  return {
    telemetryRepository: new DynamoDbTelemetryRepository(),
    rejectedTelemetryRepository: new DynamoDbRejectedTelemetryRepository(),
    logger: structuredConsoleLogger
  };
}

function mapSqsRecordToRawTelemetryMessage(record: SqsRecord): RawMessage {
  return {
    messageId: record.messageId,
    body: record.body
  };
}

export function createTelemetrySqsHandler(
  createDependencies: DependencyFactory = createDefaultDependencies
) {
  return async function telemetrySqsHandler(event: SqsBatchEvent): Promise<ProcessingSummary> {
    const messages = event.Records.map(mapSqsRecordToRawTelemetryMessage);
    let logger = structuredConsoleLogger;

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

export const handler = createTelemetrySqsHandler();
