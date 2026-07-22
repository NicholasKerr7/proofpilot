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
      CLAMAV_TIMEOUT_MS: "90000",
      PASSWORD_RESET_DELIVERY_MODE: "resend",
      RESEND_API_KEY: "re_test_key",
      AUTH_EMAIL_FROM: "ProofPilot <security@proofpilot.test>"
    });

    expect(env).toMatchObject({
      VIRUS_SCAN_MODE: "clamav",
      CLAMAV_HOST: "clamav.internal",
      CLAMAV_PORT: 13_310,
      CLAMAV_TIMEOUT_MS: 90_000
    });
  });

  it("requires production password reset email delivery", () => {
    expect(() =>
      getApiEnv({
        ...baseEnv,
        NODE_ENV: "production",
        VIRUS_SCAN_MODE: "clamav"
      })
    ).toThrow("PASSWORD_RESET_DELIVERY_MODE must be resend in production");
  });

  it("requires Resend credentials when email delivery is enabled", () => {
    expect(() =>
      getApiEnv({
        ...baseEnv,
        PASSWORD_RESET_DELIVERY_MODE: "resend"
      })
    ).toThrow("RESEND_API_KEY is required");
  });

  it("allows isolated production portfolio mode without outbound services", () => {
    expect(
      getApiEnv({
        ...baseEnv,
        NODE_ENV: "production",
        PORTFOLIO_DEMO_ACCESS_KEY: "portfolio-demo-test-key-with-32-characters",
        PROOFPILOT_MODE: "portfolio"
      })
    ).toMatchObject({
      PASSWORD_RESET_DELIVERY_MODE: "log",
      PROOFPILOT_MODE: "portfolio",
      VIRUS_SCAN_MODE: "disabled"
    });
  });

  it("requires a server-to-server access key in portfolio mode", () => {
    expect(() =>
      getApiEnv({
        ...baseEnv,
        PROOFPILOT_MODE: "portfolio"
      })
    ).toThrow("PORTFOLIO_DEMO_ACCESS_KEY is required in portfolio mode");
  });
});
