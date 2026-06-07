import {
  createTelemetryIngestAuthorizerHandler,
  isAuthorizedBearerToken
} from "../../../../../src/adapters/aws/handlers/telemetryIngestAuthorizerHandler";
import { structuredConsoleLogger } from "../../../../../src/adapters/observability/structuredConsoleLogger";

describe("telemetryIngestAuthorizerHandler", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe("isAuthorizedBearerToken", () => {
    it("authorizes a matching bearer token", () => {
      expect(isAuthorizedBearerToken("Bearer expected-token", "expected-token")).toBe(true);
    });

    it("rejects missing, malformed or incorrect tokens", () => {
      expect(isAuthorizedBearerToken(undefined, "expected-token")).toBe(false);
      expect(isAuthorizedBearerToken("expected-token", "expected-token")).toBe(false);
      expect(isAuthorizedBearerToken("Bearer wrong-token", "expected-token")).toBe(false);
      expect(isAuthorizedBearerToken("Bearer expected-token extra", "expected-token")).toBe(false);
    });

    it("fails when expected token is not configured", () => {
      // ARRANGE
      const authorizationHeader = "Bearer expected-token";
      const expectedToken = undefined;
      const expectedResult = false;

      // ACT
      const actualResult = isAuthorizedBearerToken(authorizationHeader, expectedToken);

      // ASSERT
      expect(actualResult).toBe(expectedResult);
    });
  });

  describe("createTelemetryIngestAuthorizerHandler", () => {
    it("handler returns expected result when authorized", async () => {
      // ARRANGE
      const handler = createTelemetryIngestAuthorizerHandler("expected-token");
      const expectedResult = { isAuthorized: true };

      // ACT
      const actualResult = await handler({
        headers: {
          Authorization: "Bearer expected-token"
        },
        requestContext: {
          requestId: "request-123",
          http: {
            method: "POST",
            path: "/telemetry"
          }
        }
      });

      // ASSERT
      expect(actualResult).toEqual(expectedResult);
    });

    it("handler reads the authorization header case-insensitively", async () => {
      // ARRANGE
      const handler = createTelemetryIngestAuthorizerHandler("expected-token");
      const expectedResult = { isAuthorized: true };

      // ACT
      const actualResult = await handler({
        headers: {
          authorization: "Bearer expected-token"
        }
      });

      // ASSERT
      expect(actualResult).toEqual(expectedResult);
    });

    it("handler logs unauthorized requests", async () => {
      // ARRANGE
      const warnMock = jest.spyOn(structuredConsoleLogger, "warn").mockImplementation();

      const handler = createTelemetryIngestAuthorizerHandler("expected-token");
      
      const expectedResult = { isAuthorized: false };

      // ACT
      const actualResult = await handler({
        headers: {
          authorization: "Bearer wrong-token"
        },
        requestContext: {
          requestId: "request-123",
          http: {
            method: "POST",
            path: "/telemetry"
          }
        }
      });

      // ASSERT
      expect(actualResult).toEqual(expectedResult);
      expect(warnMock).toHaveBeenCalledWith("Rejected unauthorized API telemetry ingest request", {
        source: "apiGatewayAuthorizer",
        requestId: "request-123",
        method: "POST",
        path: "/telemetry",
        reason: "invalid_token"
      });
    });
  });
});
