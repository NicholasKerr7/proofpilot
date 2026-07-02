import { z } from "zod";

const apiEnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(24),
  REDIS_URL: z.string().url().default("redis://localhost:6379")
});

export function getApiEnv() {
  return apiEnvSchema.parse(process.env);
}
