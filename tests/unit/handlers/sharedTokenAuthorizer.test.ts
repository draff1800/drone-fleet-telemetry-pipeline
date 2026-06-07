import {
  createSharedTokenAuthorizer,
  isAuthorizedBearerToken
} from "../../../src/handlers/sharedTokenAuthorizer";

describe("sharedTokenAuthorizer", () => {
  it("authorizes a matching bearer token", () => {
    expect(isAuthorizedBearerToken("Bearer expected-token", "expected-token")).toBe(true);
  });

  it("rejects missing, malformed or incorrect tokens", () => {
    expect(isAuthorizedBearerToken(undefined, "expected-token")).toBe(false);
    expect(isAuthorizedBearerToken("expected-token", "expected-token")).toBe(false);
    expect(isAuthorizedBearerToken("Bearer wrong-token", "expected-token")).toBe(false);
    expect(isAuthorizedBearerToken("Bearer expected-token extra", "expected-token")).toBe(false);
  });

  it("fails closed when the expected token is not configured", () => {
    expect(isAuthorizedBearerToken("Bearer expected-token", undefined)).toBe(false);
  });

  it("returns a simple HTTP API authorizer response", async () => {
    const authorizer = createSharedTokenAuthorizer("expected-token");

    await expect(
      authorizer({
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
      })
    ).resolves.toEqual({ isAuthorized: true });
  });

  it("reads the authorization header case-insensitively", async () => {
    const authorizer = createSharedTokenAuthorizer("expected-token");

    await expect(
      authorizer({
        headers: {
          authorization: "Bearer expected-token"
        }
      })
    ).resolves.toEqual({ isAuthorized: true });
  });
});
