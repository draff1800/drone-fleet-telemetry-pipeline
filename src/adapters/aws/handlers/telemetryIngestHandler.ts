import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

import { errorContext } from "../../observability/errorContext";
import { structuredConsoleLogger } from "../../observability/structuredConsoleLogger";
import type { Logger } from "../../../ports/observability/logger";

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

export interface TelemetryIngestHandlerDependencies {
  queueUrl: string;
  sqsClient: SqsMessageSender;
  logger: Logger;
}

type DependencyFactory = () => TelemetryIngestHandlerDependencies;

function createDefaultDependencies(): TelemetryIngestHandlerDependencies {
  const queueUrl = process.env.INGESTION_QUEUE_URL;

  if (!queueUrl) {
    throw new Error("INGESTION_QUEUE_URL is not configured");
  }

  return {
    queueUrl,
    sqsClient: new SQSClient({}),
    logger: structuredConsoleLogger
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

export function createTelemetryIngestHandler(createDependencies: DependencyFactory = createDefaultDependencies) {
  return async function telemetryIngestHandler(event: ApiGatewayHttpRequest): Promise<ApiGatewayHttpResponse> {
    const requestId = event.requestContext?.requestId;
    const body = decodeBody(event);

    let logger = structuredConsoleLogger;

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

      return jsonResponse(202, { message: "Telemetry accepted for processing" });
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

export const handler = createTelemetryIngestHandler();
