import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { DynamoDbRejectedRecordRepository } from "../aws/persistence/dynamoDbRejectedRecordRepository";
import { DynamoDbTelemetryRepository } from "../aws/persistence/dynamoDbTelemetryRepository";
import { processTelemetryMessages } from "../../core/telemetry/processTelemetryMessages";
import type { ProcessingSummary } from "../../core/telemetry/telemetryTypes";
import type { Logger } from "../../ports/observability/logger";
import {
  countLocalDynamoDbTableItems,
  createLocalDynamoDbDocumentClient,
  type LocalDynamoDbConfig,
  localDynamoDbConfigFromEnv
} from "./dynamoDbLocal";
import { parseNdjson } from "./processTelemetryFile";

export interface ProcessTelemetryFileToDynamoDbResult {
  inputPath: string;
  summary: ProcessingSummary;
  tables: {
    telemetry: string;
    rejected: string;
  };
  storedCounts: {
    telemetry: number;
    rejected: number;
  };
}

export interface ProcessTelemetryFileToDynamoDbOptions {
  inputPath: string;
  logger: Logger;
  config?: LocalDynamoDbConfig;
}

export async function processTelemetryFileToDynamoDb(
  options: ProcessTelemetryFileToDynamoDbOptions
): Promise<ProcessTelemetryFileToDynamoDbResult> {
  const config = options.config ?? localDynamoDbConfigFromEnv();
  const inputPath = resolve(process.cwd(), options.inputPath);
  const rawInput = await readFile(inputPath, "utf8");
  const inputMessages = parseNdjson(rawInput);
  const documentClient = createLocalDynamoDbDocumentClient(config);

  const summary = await processTelemetryMessages(inputMessages, {
    telemetryRepository: new DynamoDbTelemetryRepository({
      tableName: config.telemetryTableName,
      client: documentClient
    }),
    rejectedRecordRepository: new DynamoDbRejectedRecordRepository({
      tableName: config.rejectedTableName,
      client: documentClient
    }),
    logger: options.logger
  });

  return {
    inputPath,
    summary,
    tables: {
      telemetry: config.telemetryTableName,
      rejected: config.rejectedTableName
    },
    storedCounts: {
      telemetry: await countLocalDynamoDbTableItems(documentClient, config.telemetryTableName),
      rejected: await countLocalDynamoDbTableItems(documentClient, config.rejectedTableName)
    }
  };
}
