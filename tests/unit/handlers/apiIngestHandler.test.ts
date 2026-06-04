import { SendMessageCommand } from "@aws-sdk/client-sqs";

import {
  createApiIngestHandler,
  type ApiGatewayHttpRequest,
  type SqsMessageSender
} from "../../../src/handlers/apiIngestHandler";
import type { Logger } from "../../../src/ports/observability/logger";

function logger(): Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

function request(body: string | null | undefined): ApiGatewayHttpRequest {
  return {
    body,
    requestContext: {
      requestId: "request-123"
    }
  };
}

function validBody(): string {
  return JSON.stringify({
    droneId: "drone-001",
    timestamp: "2026-06-03T20:00:00.000Z",
    eventType: "SENSOR_READING",
    statusCode: "OK",
    telemetryData: {
      latitude: 54.5973,
      longitude: -5.9301
    }
  });
}

describe("apiIngestHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when the request body is missing", async () => {
    const testLogger = logger();
    const sqsClient: SqsMessageSender = {
      send: jest.fn()
    };
    const handler = createApiIngestHandler(() => ({
      logger: testLogger,
      queueUrl: "https://sqs.example.test/telemetry",
      sqsClient
    }));

    const response = await handler(request(null));

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ message: "Request body is required" });
    expect(sqsClient.send).not.toHaveBeenCalled();
    expect(testLogger.warn).not.toHaveBeenCalled();
  });

  it("returns 400 when the request body is not valid JSON", async () => {
    const testLogger = logger();
    const sqsClient: SqsMessageSender = {
      send: jest.fn()
    };
    const handler = createApiIngestHandler(() => ({
      logger: testLogger,
      queueUrl: "https://sqs.example.test/telemetry",
      sqsClient
    }));

    const response = await handler(request("{not-json"));

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ message: "Request body must be valid JSON" });
    expect(sqsClient.send).not.toHaveBeenCalled();
    expect(testLogger.warn).not.toHaveBeenCalled();
  });

  it("sends the raw JSON body to SQS and returns 202 Accepted", async () => {
    const body = validBody();
    const testLogger = logger();
    const sqsClient: SqsMessageSender = {
      send: jest.fn(async () => ({ MessageId: "sqs-message-123" }))
    };
    const handler = createApiIngestHandler(() => ({
      logger: testLogger,
      queueUrl: "https://sqs.example.test/telemetry",
      sqsClient
    }));

    const response = await handler(request(body));
    const command = jest.mocked(sqsClient.send).mock.calls[0]?.[0];

    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.body)).toEqual({ message: "Accepted" });
    expect(command).toBeInstanceOf(SendMessageCommand);
    expect(command?.input).toEqual({
      QueueUrl: "https://sqs.example.test/telemetry",
      MessageBody: body
    });
    expect(testLogger.info).toHaveBeenCalledWith("Accepted API telemetry ingest request", {
      source: "apiGateway",
      requestId: "request-123",
      messageId: "sqs-message-123",
      bodyBytes: Buffer.byteLength(body, "utf8")
    });
  });

  it("does not perform full telemetry validation before enqueueing", async () => {
    const body = JSON.stringify({ droneId: "" });
    const testLogger = logger();
    const sqsClient: SqsMessageSender = {
      send: jest.fn(async () => ({ MessageId: "sqs-message-123" }))
    };
    const handler = createApiIngestHandler(() => ({
      logger: testLogger,
      queueUrl: "https://sqs.example.test/telemetry",
      sqsClient
    }));

    const response = await handler(request(body));
    const command = jest.mocked(sqsClient.send).mock.calls[0]?.[0];

    expect(response.statusCode).toBe(202);
    expect(command?.input.MessageBody).toBe(body);
  });

  it("rethrows SQS failures as system failures and logs structured context", async () => {
    const body = validBody();
    const testLogger = logger();
    const failure = new Error("SQS unavailable");
    const sqsClient: SqsMessageSender = {
      send: jest.fn(async () => {
        throw failure;
      })
    };
    const handler = createApiIngestHandler(() => ({
      logger: testLogger,
      queueUrl: "https://sqs.example.test/telemetry",
      sqsClient
    }));

    await expect(handler(request(body))).rejects.toThrow("SQS unavailable");

    expect(testLogger.error).toHaveBeenCalledWith(
      "Failed to enqueue API telemetry ingest request",
      expect.objectContaining({
        source: "apiGateway",
        requestId: "request-123",
        bodyBytes: Buffer.byteLength(body, "utf8"),
        errorName: "Error",
        errorMessage: "SQS unavailable"
      })
    );
  });
});
