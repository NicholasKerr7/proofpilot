import { z } from "zod";

const workerEnvObjectSchema = z.object({
  NODE_ENV: z.string().default("development"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  NOTIFICATION_EMAIL_DELIVERY_MODE: z.enum(["log", "resend"]).default("log"),
  RESEND_API_KEY: z.string().min(1).optional(),
  AUTH_EMAIL_FROM: z.string().min(3).max(254).optional(),
  OCR_LANGUAGES: z.string().min(2).default("eng"),
  OCR_CACHE_PATH: z.string().min(1).default("/tmp/proofpilot-ocr"),
  TESSERACT_LANG_PATH: z.string().min(1).optional()
});

const workerEnvSchema = workerEnvObjectSchema.superRefine((env, context) => {
  if (
    env.NODE_ENV === "production" &&
    env.NOTIFICATION_EMAIL_DELIVERY_MODE !== "resend"
  ) {
    context.addIssue({
      code: "custom",
      message: "NOTIFICATION_EMAIL_DELIVERY_MODE must be resend in production.",
      path: ["NOTIFICATION_EMAIL_DELIVERY_MODE"]
    });
  }

  if (env.NOTIFICATION_EMAIL_DELIVERY_MODE === "resend" && !env.RESEND_API_KEY) {
    context.addIssue({
      code: "custom",
      message: "RESEND_API_KEY is required when notification email delivery uses Resend.",
      path: ["RESEND_API_KEY"]
    });
  }

  if (env.NOTIFICATION_EMAIL_DELIVERY_MODE === "resend" && !env.AUTH_EMAIL_FROM) {
    context.addIssue({
      code: "custom",
      message: "AUTH_EMAIL_FROM is required when notification email delivery uses Resend.",
      path: ["AUTH_EMAIL_FROM"]
    });
  }
});

export function getWorkerEnv(env: NodeJS.ProcessEnv = process.env) {
  return workerEnvSchema.parse(env);
}
