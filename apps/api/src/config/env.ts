import { z } from "zod";

const booleanEnvSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalizedValue)) {
    return false;
  }

  return value;
}, z.boolean());

const apiEnvObjectSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(24),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  ERROR_MONITORING_ENVIRONMENT: z.string().min(1).optional(),
  ERROR_MONITORING_WEBHOOK_URL: z.string().url().optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  TRUST_PROXY: booleanEnvSchema.default(false),
  VIRUS_SCAN_MODE: z.enum(["disabled", "clamav"]).default("disabled"),
  CLAMAV_HOST: z.string().min(1).default("127.0.0.1"),
  CLAMAV_PORT: z.coerce.number().int().positive().max(65_535).default(3310),
  CLAMAV_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(60_000)
});

const apiEnvSchema = apiEnvObjectSchema.superRefine((env, context) => {
  if (env.NODE_ENV === "production" && env.VIRUS_SCAN_MODE !== "clamav") {
    context.addIssue({
      code: "custom",
      message: "VIRUS_SCAN_MODE must be clamav in production.",
      path: ["VIRUS_SCAN_MODE"]
    });
  }
});

const rateLimitEnvSchema = apiEnvObjectSchema.pick({
  RATE_LIMIT_MAX: true,
  RATE_LIMIT_WINDOW_MS: true
});

export function getApiEnv(env: NodeJS.ProcessEnv = process.env) {
  const parsedEnv = apiEnvSchema.parse(env);

  return {
    ...parsedEnv,
    ERROR_MONITORING_ENVIRONMENT: parsedEnv.ERROR_MONITORING_ENVIRONMENT ?? parsedEnv.NODE_ENV
  };
}

export function getRateLimitEnv(env: NodeJS.ProcessEnv = process.env) {
  return rateLimitEnvSchema.parse(env);
}
