import { z } from "zod";

const workerEnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().default("redis://localhost:6379")
});

export function getWorkerEnv() {
  return workerEnvSchema.parse(process.env);
}
