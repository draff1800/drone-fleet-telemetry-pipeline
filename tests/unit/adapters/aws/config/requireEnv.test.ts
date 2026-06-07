import { requireEnv } from "../../../../../src/adapters/aws/config/requireEnv";

describe("requireEnv", () => {
  afterEach(() => {
    delete process.env.REQUIRED_ENV;
  });

  it("returns the environment variable value when configured", () => {
    process.env.REQUIRED_ENV = "example-value";

    expect(requireEnv("REQUIRED_ENV")).toBe("example-value");
  });

  it("throws an error when environment variable is missing", () => {
    expect(() => requireEnv("REQUIRED_ENV")).toThrow(
      "Environment variable (REQUIRED_ENV) not set"
    );
  });
});
