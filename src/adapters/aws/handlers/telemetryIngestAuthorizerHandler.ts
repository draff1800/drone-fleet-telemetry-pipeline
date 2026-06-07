import { timingSafeEqual } from "node:crypto";

import { structuredConsoleLogger } from "../../observability/structuredConsoleLogger";

export interface IngestAuthorizerEvent {
  headers?: Record<string, string | undefined>;
  requestContext?: {
    requestId?: string;
    http?: {
      method?: string;
      path?: string;
    };
  };
}

export interface IngestAuthorizerResponse {
  isAuthorized: boolean;
}

function getHeaderValue(
  headers: Record<string, string | undefined> | undefined, 
  targetHeaderName: string
): string | undefined {
  if (!headers) {
    return undefined;
  }

  const expected = targetHeaderName.toLowerCase();
  const matchingHeader = Object.entries(headers).find(([key]) => key.toLowerCase() === expected);

  if (!matchingHeader) {
    return undefined;
  }

  const [, headerValue] = matchingHeader;

  return headerValue;
}

function extractBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token, ...unexpectedParts] = authorizationHeader.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token || unexpectedParts.length > 0) {
    return undefined;
  }

  return token;
}

function tokensMatchSafely(
  presentedToken: string, 
  expectedToken: string
): boolean {
  const presentedBuffer = Buffer.from(presentedToken, "utf8");
  const expectedBuffer = Buffer.from(expectedToken, "utf8");

  if (presentedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(presentedBuffer, expectedBuffer);
}

export function isAuthorizedBearerToken(
  authorizationHeader: string | undefined,
  expectedToken: string | undefined
): boolean {
  if (!expectedToken) {
    return false;
  }

  const presentedToken = extractBearerToken(authorizationHeader);

  return presentedToken ? tokensMatchSafely(presentedToken, expectedToken) : false;
}

export function createTelemetryIngestAuthorizerHandler(expectedToken = process.env.INGEST_AUTH_TOKEN) {
  return async function telemetryIngestAuthorizerHandler(
    event: IngestAuthorizerEvent
  ): Promise<IngestAuthorizerResponse> {
    const isAuthorized = isAuthorizedBearerToken(
      getHeaderValue(event.headers, "authorization"), expectedToken
    );

    if (!isAuthorized) {
      structuredConsoleLogger.warn("Rejected unauthorized API telemetry ingest request", {
        source: "apiGatewayAuthorizer",
        requestId: event.requestContext?.requestId,
        method: event.requestContext?.http?.method,
        path: event.requestContext?.http?.path,
        reason: expectedToken ? "invalid_token" : "missing_expected_token"
      });
    }

    return { isAuthorized };
  };
}

export const handler = createTelemetryIngestAuthorizerHandler();
