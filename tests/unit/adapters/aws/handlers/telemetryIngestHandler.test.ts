import { SendMessageCommand } from "@aws-sdk/client-sqs";

import {
  createTelemetryIngestHandler,
  type ApiGatewayHttpRequest,
  type SqsMessageSender
} from "../../../../../src/adapters/aws/handlers/telemetryIngestHandler";
import type { Logger } from "../../../../../src/ports/observability/logger";

function logger(): Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

function request(
  body: string | null | undefined,
  options: Pick<ApiGatewayHttpRequest, "isBase64Encoded"> = {}
): ApiGatewayHttpRequest {
  return {
    body,
    ...options,
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

describe("telemetryIngestHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handler returns 400 when the request body is missing", async () => {
    // ARRANGE
    const testLogger = logger();
    const sqsClient: SqsMessageSender = {
      send: jest.fn()
    };
    const handler = createTelemetryIngestHandler(() => ({
      logger: testLogger,
      queueUrl: "https://sqs.example.test/telemetry",
      sqsClient
    }));
    const expectedResult = {
      statusCode: 400,
      body: { message: "Request body is required" }
    };

    // ACT
    const actualResult = await handler(request(null));

    // ASSERT
    expect(actualResult.statusCode).toBe(expectedResult.statusCode);
    expect(JSON.parse(actualResult.body)).toEqual(expectedResult.body);
    expect(sqsClient.send).not.toHaveBeenCalled();
    expect(testLogger.warn).not.toHaveBeenCalled();
  });

  it("handler returns 400 when the request body is not valid JSON", async () => {
    // ARRANGE
    const testLogger = logger();
    const sqsClient: SqsMessageSender = {
      send: jest.fn()
    };
    const handler = createTelemetryIngestHandler(() => ({
      logger: testLogger,
      queueUrl: "https://sqs.example.test/telemetry",
      sqsClient
    }));
    const expectedResult = {
      statusCode: 400,
      body: { message: "Request body must be valid JSON" }
    };

    // ACT
    const actualResult = await handler(request("{not-json"));

    // ASSERT
    expect(actualResult.statusCode).toBe(expectedResult.statusCode);
    expect(JSON.parse(actualResult.body)).toEqual(expectedResult.body);
    expect(sqsClient.send).not.toHaveBeenCalled();
    expect(testLogger.warn).not.toHaveBeenCalled();
  });

  it("handler sends the raw JSON body to SQS and returns 202 Accepted", async () => {
    // ARRANGE
    const body = validBody();
    const testLogger = logger();
    const sqsClient: SqsMessageSender = {
      send: jest.fn(async () => ({ MessageId: "sqs-message-123" }))
    };
    const handler = createTelemetryIngestHandler(() => ({
      logger: testLogger,
      queueUrl: "https://sqs.example.test/telemetry",
      sqsClient
    }));
    const expectedResult = {
      statusCode: 202,
      body: { message: "Telemetry accepted for processing" }
    };
    const expectedCommandInput = {
      QueueUrl: "https://sqs.example.test/telemetry",
      MessageBody: body
    };

    // ACT
    const actualResult = await handler(request(body));
    const command = jest.mocked(sqsClient.send).mock.calls[0]?.[0];

    // ASSERT
    expect(actualResult.statusCode).toBe(expectedResult.statusCode);
    expect(JSON.parse(actualResult.body)).toEqual(expectedResult.body);
    expect(command).toBeInstanceOf(SendMessageCommand);
    expect(command?.input).toEqual(expectedCommandInput);
    expect(testLogger.info).toHaveBeenCalledWith("Accepted API telemetry ingest request", {
      source: "apiGateway",
      requestId: "request-123",
      messageId: "sqs-message-123",
      bodyBytes: Buffer.byteLength(body, "utf8")
    });
  });

  it("handler decodes base64 encoded request bodies before enqueueing", async () => {
    // ARRANGE
    const body = validBody();
    const encodedBody = Buffer.from(body, "utf8").toString("base64");
    const testLogger = logger();
    const sqsClient: SqsMessageSender = {
      send: jest.fn(async () => ({ MessageId: "sqs-message-123" }))
    };
    const handler = createTelemetryIngestHandler(() => ({
      logger: testLogger,
      queueUrl: "https://sqs.example.test/telemetry",
      sqsClient
    }));
    const expectedResult = {
      statusCode: 202,
      messageBody: body
    };

    // ACT
    const actualResult = await handler(request(encodedBody, { isBase64Encoded: true }));
    const command = jest.mocked(sqsClient.send).mock.calls[0]?.[0];

    // ASSERT
    expect(actualResult.statusCode).toBe(expectedResult.statusCode);
    expect(command?.input.MessageBody).toBe(expectedResult.messageBody);
    expect(testLogger.info).toHaveBeenCalledWith("Accepted API telemetry ingest request", {
      source: "apiGateway",
      requestId: "request-123",
      messageId: "sqs-message-123",
      bodyBytes: Buffer.byteLength(body, "utf8")
    });
  });

  it("handler does not perform full telemetry validation before enqueueing", async () => {
    // ARRANGE
    const body = JSON.stringify({ droneId: "" });
    const testLogger = logger();
    const sqsClient: SqsMessageSender = {
      send: jest.fn(async () => ({ MessageId: "sqs-message-123" }))
    };
    const handler = createTelemetryIngestHandler(() => ({
      logger: testLogger,
      queueUrl: "https://sqs.example.test/telemetry",
      sqsClient
    }));
    const expectedResult = {
      statusCode: 202,
      messageBody: body
    };

    // ACT
    const actualResult = await handler(request(body));
    const command = jest.mocked(sqsClient.send).mock.calls[0]?.[0];

    // ASSERT
    expect(actualResult.statusCode).toBe(expectedResult.statusCode);
    expect(command?.input.MessageBody).toBe(expectedResult.messageBody);
  });

  it("rethrows SQS failures as system failures and logs structured context", async () => {
    // ARRANGE
    const body = validBody();
    const testLogger = logger();
    const failure = new Error("SQS unavailable");
    const sqsClient: SqsMessageSender = {
      send: jest.fn(async () => {
        throw failure;
      })
    };
    const handler = createTelemetryIngestHandler(() => ({
      logger: testLogger,
      queueUrl: "https://sqs.example.test/telemetry",
      sqsClient
    }));
    const expectedErrorMessage = "SQS unavailable";

    // ACT
    const actualResult = handler(request(body));

    // ASSERT
    await expect(actualResult).rejects.toThrow(expectedErrorMessage);
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
