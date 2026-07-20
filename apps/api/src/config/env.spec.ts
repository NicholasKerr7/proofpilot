import { describe, expect, it } from "vitest";
import { getApiEnv } from "./env.js";

const baseEnv = {
  DATABASE_URL: "postgresql://proofpilot:proofpilot@localhost:5432/proofpilot",
  JWT_SECRET: "a-secure-test-secret-with-length"
};

describe("getApiEnv", () => {
  it("parses explicit false boolean env values", () => {
    const env = getApiEnv({
      ...baseEnv,
      TRUST_PROXY: "false"
    });

    expect(env.TRUST_PROXY).toBe(false);
  });

  it("parses explicit true boolean env values", () => {
    const env = getApiEnv({
      ...baseEnv,
      TRUST_PROXY: "true"
    });

    expect(env.TRUST_PROXY).toBe(true);
  });

  it("requires ClamAV scanning in production", () => {
    expect(() =>
      getApiEnv({
        ...baseEnv,
        NODE_ENV: "production"
      })
    ).toThrow("VIRUS_SCAN_MODE must be clamav in production");
  });

  it("parses an enabled ClamAV configuration", () => {
    const env = getApiEnv({
      ...baseEnv,
      NODE_ENV: "production",
      VIRUS_SCAN_MODE: "clamav",
      CLAMAV_HOST: "clamav.internal",
      CLAMAV_PORT: "13310",
      CLAMAV_TIMEOUT_MS: "90000"
    });

    expect(env).toMatchObject({
      VIRUS_SCAN_MODE: "clamav",
      CLAMAV_HOST: "clamav.internal",
      CLAMAV_PORT: 13_310,
      CLAMAV_TIMEOUT_MS: 90_000
    });
  });
});
