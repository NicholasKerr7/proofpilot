import { z } from "zod";

const developmentWorkerJwtSecret =
  "proofpilot-development-worker-signing-secret";

const workerEnvObjectSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PROOFPILOT_MODE: z.enum(["standard", "portfolio"]).default("standard"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(24).default(developmentWorkerJwtSecret),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  NOTIFICATION_EMAIL_DELIVERY_MODE: z.enum(["log", "resend"]).default("log"),
  PACKET_SHARE_EMAIL_DELIVERY_MODE: z.enum(["log", "resend"]).default("log"),
  RESEND_API_KEY: z.string().min(1).optional(),
  AUTH_EMAIL_FROM: z.string().min(3).max(254).optional(),
  OCR_LANGUAGES: z.string().min(2).default("eng"),
  OCR_CACHE_PATH: z.string().min(1).default("/tmp/proofpilot-ocr"),
  TESSERACT_LANG_PATH: z.string().min(1).optional()
});

const workerEnvSchema = workerEnvObjectSchema.superRefine((env, context) => {
  if (
    env.NODE_ENV === "production" &&
    env.PROOFPILOT_MODE === "standard" &&
    env.JWT_SECRET === developmentWorkerJwtSecret
  ) {
    context.addIssue({
      code: "custom",
      message: "JWT_SECRET must be configured in production.",
      path: ["JWT_SECRET"]
    });
  }

  if (
    env.NODE_ENV === "production" &&
    env.PROOFPILOT_MODE === "standard" &&
    env.NOTIFICATION_EMAIL_DELIVERY_MODE !== "resend"
  ) {
    context.addIssue({
      code: "custom",
      message: "NOTIFICATION_EMAIL_DELIVERY_MODE must be resend in production.",
      path: ["NOTIFICATION_EMAIL_DELIVERY_MODE"]
    });
  }

  if (
    env.NODE_ENV === "production" &&
    env.PROOFPILOT_MODE === "standard" &&
    env.PACKET_SHARE_EMAIL_DELIVERY_MODE !== "resend"
  ) {
    context.addIssue({
      code: "custom",
      message: "PACKET_SHARE_EMAIL_DELIVERY_MODE must be resend in production.",
      path: ["PACKET_SHARE_EMAIL_DELIVERY_MODE"]
    });
  }

  const usesResend =
    env.NOTIFICATION_EMAIL_DELIVERY_MODE === "resend" ||
    env.PACKET_SHARE_EMAIL_DELIVERY_MODE === "resend";

  if (usesResend && !env.RESEND_API_KEY) {
    context.addIssue({
      code: "custom",
      message: "RESEND_API_KEY is required when email delivery uses Resend.",
      path: ["RESEND_API_KEY"]
    });
  }

  if (usesResend && !env.AUTH_EMAIL_FROM) {
    context.addIssue({
      code: "custom",
      message: "AUTH_EMAIL_FROM is required when email delivery uses Resend.",
      path: ["AUTH_EMAIL_FROM"]
    });
  }
});

export function getWorkerEnv(env: NodeJS.ProcessEnv = process.env) {
  return workerEnvSchema.parse(env);
}
