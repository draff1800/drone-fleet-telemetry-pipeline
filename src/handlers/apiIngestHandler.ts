import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

import { consoleLogger } from "../adapters/local/observability/consoleLogger";
import type { Logger } from "../ports/observability/logger";

export interface ApiGatewayHttpRequest {
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext?: {
    requestId?: string;
  };
}

export interface ApiGatewayHttpResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

export interface SqsMessageSender {
  send(command: SendMessageCommand): Promise<unknown>;
}

export interface ApiIngestHandlerDependencies {
  logger: Logger;
  queueUrl: string;
  sqsClient: SqsMessageSender;
}

type DependencyFactory = () => ApiIngestHandlerDependencies;

function createDefaultDependencies(): ApiIngestHandlerDependencies {
  const queueUrl = process.env.INGESTION_QUEUE_URL;

  if (!queueUrl) {
    throw new Error("INGESTION_QUEUE_URL is not configured");
  }

  return {
    logger: consoleLogger,
    queueUrl,
    sqsClient: new SQSClient({})
  };
}

function jsonResponse(statusCode: number, payload: Record<string, unknown>): ApiGatewayHttpResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  };
}

function decodeBody(event: ApiGatewayHttpRequest): string | null {
  if (!event.body) {
    return null;
  }

  if (event.isBase64Encoded) {
    return Buffer.from(event.body, "base64").toString("utf8");
  }

  return event.body;
}

function isJson(body: string): boolean {
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
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

export function createApiIngestHandler(createDependencies: DependencyFactory = createDefaultDependencies) {
  return async function apiIngestHandler(event: ApiGatewayHttpRequest): Promise<ApiGatewayHttpResponse> {
    let logger = consoleLogger;
    const requestId = event.requestContext?.requestId;
    const body = decodeBody(event);

    if (!body) {
      logger.warn("Rejected API telemetry ingest request with missing body", {
        source: "apiGateway",
        requestId
      });

      return jsonResponse(400, { message: "Request body is required" });
    }

    if (!isJson(body)) {
      logger.warn("Rejected API telemetry ingest request with invalid JSON body", {
        source: "apiGateway",
        requestId,
        bodyBytes: Buffer.byteLength(body, "utf8")
      });

      return jsonResponse(400, { message: "Request body must be valid JSON" });
    }

    try {
      const dependencies = createDependencies();
      logger = dependencies.logger;

      const response = await dependencies.sqsClient.send(
        new SendMessageCommand({
          QueueUrl: dependencies.queueUrl,
          MessageBody: body
        })
      );

      const messageId =
        typeof response === "object" && response !== null && "MessageId" in response
          ? response.MessageId
          : undefined;

      logger.info("Accepted API telemetry ingest request", {
        source: "apiGateway",
        requestId,
        messageId,
        bodyBytes: Buffer.byteLength(body, "utf8")
      });

      return jsonResponse(202, { message: "Accepted" });
    } catch (error: unknown) {
      logger.error("Failed to enqueue API telemetry ingest request", {
        source: "apiGateway",
        requestId,
        bodyBytes: Buffer.byteLength(body, "utf8"),
        ...errorContext(error)
      });
      throw error;
    }
  };
}

export const handler = createApiIngestHandler();
