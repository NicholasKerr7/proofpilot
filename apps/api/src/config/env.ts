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
  PROOFPILOT_MODE: z.enum(["standard", "portfolio"]).default("standard"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(24),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  AUTH_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  PASSWORD_RESET_DELIVERY_MODE: z.enum(["log", "resend"]).default("log"),
  PACKET_SHARE_EMAIL_DELIVERY_MODE: z.enum(["log", "resend"]).default("log"),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
  PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS: z.coerce.number().int().min(30).max(3600).default(60),
  RESEND_API_KEY: z.string().min(1).optional(),
  AUTH_EMAIL_FROM: z.string().min(3).max(254).optional(),
  ERROR_MONITORING_ENVIRONMENT: z.string().min(1).optional(),
  ERROR_MONITORING_WEBHOOK_URL: z.string().url().optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  TRUST_PROXY: booleanEnvSchema.default(false),
  VIRUS_SCAN_MODE: z.enum(["disabled", "clamav"]).default("disabled"),
  CLAMAV_HOST: z.string().min(1).default("127.0.0.1"),
  CLAMAV_PORT: z.coerce.number().int().positive().max(65_535).default(3310),
  CLAMAV_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(60_000),
  PORTFOLIO_DEMO_ACCESS_KEY: z.string().min(32).optional(),
  PORTFOLIO_DEMO_TEMPLATE_EMAIL: z
    .string()
    .email()
    .default("nicholas.kerr@proofpilot.test"),
  PORTFOLIO_DEMO_TTL_MINUTES: z.coerce.number().int().min(30).max(1_440).default(120),
  PORTFOLIO_DEMO_MAX_ACTIVE_WORKSPACES: z.coerce
    .number()
    .int()
    .min(1)
    .max(500)
    .default(50)
});

const apiEnvSchema = apiEnvObjectSchema.superRefine((env, context) => {
  const requiresProductionServices =
    env.NODE_ENV === "production" && env.PROOFPILOT_MODE === "standard";

  if (requiresProductionServices && env.VIRUS_SCAN_MODE !== "clamav") {
    context.addIssue({
      code: "custom",
      message: "VIRUS_SCAN_MODE must be clamav in production.",
      path: ["VIRUS_SCAN_MODE"]
    });
  }

  if (requiresProductionServices && env.PASSWORD_RESET_DELIVERY_MODE !== "resend") {
    context.addIssue({
      code: "custom",
      message: "PASSWORD_RESET_DELIVERY_MODE must be resend in production.",
      path: ["PASSWORD_RESET_DELIVERY_MODE"]
    });
  }

  if (
    requiresProductionServices &&
    env.PACKET_SHARE_EMAIL_DELIVERY_MODE !== "resend"
  ) {
    context.addIssue({
      code: "custom",
      message: "PACKET_SHARE_EMAIL_DELIVERY_MODE must be resend in production.",
      path: ["PACKET_SHARE_EMAIL_DELIVERY_MODE"]
    });
  }

  const usesResend =
    env.PASSWORD_RESET_DELIVERY_MODE === "resend" ||
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

  if (env.PROOFPILOT_MODE === "portfolio" && !env.PORTFOLIO_DEMO_ACCESS_KEY) {
    context.addIssue({
      code: "custom",
      message: "PORTFOLIO_DEMO_ACCESS_KEY is required in portfolio mode.",
      path: ["PORTFOLIO_DEMO_ACCESS_KEY"]
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
