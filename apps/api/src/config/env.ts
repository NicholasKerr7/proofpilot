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

const apiEnvSchema = z.object({
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
  TRUST_PROXY: booleanEnvSchema.default(false)
});

export function getApiEnv(env: NodeJS.ProcessEnv = process.env) {
  const parsedEnv = apiEnvSchema.parse(env);

  return {
    ...parsedEnv,
    ERROR_MONITORING_ENVIRONMENT: parsedEnv.ERROR_MONITORING_ENVIRONMENT ?? parsedEnv.NODE_ENV
  };
}
