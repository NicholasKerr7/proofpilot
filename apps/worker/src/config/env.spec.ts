import { describe, expect, it } from "vitest";
import { getWorkerEnv } from "./env.js";

const baseEnv = {
  DATABASE_URL: "postgresql://proofpilot:proofpilot@localhost:5432/proofpilot"
};

describe("getWorkerEnv", () => {
  it("defaults notification email delivery to log mode outside production", () => {
    expect(getWorkerEnv(baseEnv).NOTIFICATION_EMAIL_DELIVERY_MODE).toBe("log");
  });

  it("requires Resend notification delivery in production", () => {
    expect(() =>
      getWorkerEnv({
        ...baseEnv,
        NODE_ENV: "production"
      })
    ).toThrow("NOTIFICATION_EMAIL_DELIVERY_MODE must be resend in production");
  });

  it("allows log-only delivery for an isolated production portfolio demo", () => {
    expect(
      getWorkerEnv({
        ...baseEnv,
        NODE_ENV: "production",
        PROOFPILOT_MODE: "portfolio"
      })
    ).toMatchObject({
      NOTIFICATION_EMAIL_DELIVERY_MODE: "log",
      PROOFPILOT_MODE: "portfolio"
    });
  });

  it("requires Resend credentials when notification delivery is enabled", () => {
    expect(() =>
      getWorkerEnv({
        ...baseEnv,
        NOTIFICATION_EMAIL_DELIVERY_MODE: "resend"
      })
    ).toThrow("RESEND_API_KEY is required");

    expect(() =>
      getWorkerEnv({
        ...baseEnv,
        NOTIFICATION_EMAIL_DELIVERY_MODE: "resend",
        RESEND_API_KEY: "re_test_key"
      })
    ).toThrow("AUTH_EMAIL_FROM is required");
  });

  it("accepts complete Resend notification delivery configuration", () => {
    expect(
      getWorkerEnv({
        ...baseEnv,
        AUTH_EMAIL_FROM: "ProofPilot <updates@proofpilot.test>",
        NOTIFICATION_EMAIL_DELIVERY_MODE: "resend",
        RESEND_API_KEY: "re_test_key",
        WEB_ORIGIN: "https://app.proofpilot.test"
      })
    ).toMatchObject({
      AUTH_EMAIL_FROM: "ProofPilot <updates@proofpilot.test>",
      NOTIFICATION_EMAIL_DELIVERY_MODE: "resend",
      WEB_ORIGIN: "https://app.proofpilot.test"
    });
  });
});
