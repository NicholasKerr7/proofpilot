import { z } from "zod";

const workerEnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  OCR_LANGUAGES: z.string().min(2).default("eng"),
  OCR_CACHE_PATH: z.string().min(1).default("/tmp/proofpilot-ocr"),
  TESSERACT_LANG_PATH: z.string().min(1).optional()
});

export function getWorkerEnv() {
  return workerEnvSchema.parse(process.env);
}
