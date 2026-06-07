import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { DynamoDbRejectedTelemetryRepository } from "../../aws/persistence/dynamoDbRejectedTelemetryRepository";
import { DynamoDbTelemetryRepository } from "../../aws/persistence/dynamoDbTelemetryRepository";
import { processTelemetryMessages } from "../../../core/telemetry/processTelemetryMessages";
import type { ProcessingSummary } from "../../../core/telemetry/telemetryProcessingTypes";
import type { Logger } from "../../../ports/observability/logger";
import {
  countLocalDynamoDbTableItems,
  createLocalDynamoDbDocumentClient,
  type LocalDynamoDbConfig,
  localDynamoDbConfigFromEnv
} from "../persistence/local-dynamo-db/localDynamoDb";
import { parseTelemetryNdjson } from "./telemetryNdjsonParser";

export interface TelemetryProcessingToDynamoDbResult {
  inputPath: string;
  summary: ProcessingSummary;
  storedCounts: {
    telemetry: number;
    rejected: number;
  };
  tables: {
    telemetry: string;
    rejected: string;
  };
}

export interface TelemetryProcessingToDynamoDbOptions {
  inputPath: string;
  dbConfig?: LocalDynamoDbConfig;
  logger: Logger;
}

export async function processTelemetryFileToDynamoDb(
  options: TelemetryProcessingToDynamoDbOptions
): Promise<TelemetryProcessingToDynamoDbResult> {
  const inputPath = resolve(process.cwd(), options.inputPath);
  const dbConfig = options.dbConfig ?? localDynamoDbConfigFromEnv();

  const dbDocumentClient = createLocalDynamoDbDocumentClient(dbConfig)

  const rawInput = await readFile(inputPath, "utf8");
  const inputMessages = parseTelemetryNdjson(rawInput);

  const telemetryRepository = new DynamoDbTelemetryRepository({
    tableName: dbConfig.telemetryTableName,
    client: dbDocumentClient
  });
  const rejectedTelemetryRepository = new DynamoDbRejectedTelemetryRepository({
    tableName: dbConfig.rejectedTelemetryTableName,
    client: dbDocumentClient
  });

  const summary = await processTelemetryMessages(inputMessages, {
    telemetryRepository: telemetryRepository,
    rejectedTelemetryRepository: rejectedTelemetryRepository,
    logger: options.logger
  });

  return {
    inputPath,
    summary,
    storedCounts: {
      telemetry: await countLocalDynamoDbTableItems(dbDocumentClient, dbConfig.telemetryTableName),
      rejected: await countLocalDynamoDbTableItems(dbDocumentClient, dbConfig.rejectedTelemetryTableName)
    },
    tables: {
      telemetry: dbConfig.telemetryTableName,
      rejected: dbConfig.rejectedTelemetryTableName
    }
  };
}
