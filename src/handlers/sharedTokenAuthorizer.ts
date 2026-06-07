import { timingSafeEqual } from "node:crypto";

import { consoleLogger } from "../adapters/local/observability/consoleLogger";

export interface HttpApiAuthorizerEvent {
  headers?: Record<string, string | undefined>;
  requestContext?: {
    requestId?: string;
    http?: {
      method?: string;
      path?: string;
    };
  };
}

export interface HttpApiAuthorizerResponse {
  isAuthorized: boolean;
}

function getHeader(headers: Record<string, string | undefined> | undefined, name: string): string | undefined {
  if (!headers) {
    return undefined;
  }

  const expected = name.toLowerCase();
  const matchingHeader = Object.entries(headers).find(([key]) => key.toLowerCase() === expected);

  return matchingHeader?.[1];
}

function extractBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token, ...extraParts] = authorizationHeader.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token || extraParts.length > 0) {
    return undefined;
  }

  return token;
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAuthorizedBearerToken(
  authorizationHeader: string | undefined,
  expectedToken: string | undefined
): boolean {
  if (!expectedToken) {
    return false;
  }

  const presentedToken = extractBearerToken(authorizationHeader);

  return presentedToken ? constantTimeEquals(presentedToken, expectedToken) : false;
}

export function createSharedTokenAuthorizer(expectedToken = process.env.INGEST_AUTH_TOKEN) {
  return async function sharedTokenAuthorizer(
    event: HttpApiAuthorizerEvent
  ): Promise<HttpApiAuthorizerResponse> {
    const isAuthorized = isAuthorizedBearerToken(getHeader(event.headers, "authorization"), expectedToken);

    if (!isAuthorized) {
      consoleLogger.warn("Rejected unauthorized API telemetry ingest request", {
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

export const handler = createSharedTokenAuthorizer();
