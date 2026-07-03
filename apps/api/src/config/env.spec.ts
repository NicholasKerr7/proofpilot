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
});
