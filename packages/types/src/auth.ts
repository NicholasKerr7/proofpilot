import { z } from "zod";
import { sanitizeUserText } from "./text.js";

export const registerSchema = z.object({
  email: z.string().email(),
  name: z
    .string()
    .transform((value) => sanitizeUserText(value, { singleLine: true }))
    .pipe(z.string().min(1).max(120))
    .optional(),
  password: z.string().min(8).max(120)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(120)
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/),
  newPassword: z.string().min(8).max(120)
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  isPortfolioDemo: boolean;
  portfolioDemoExpiresAt: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ChangePasswordResponse {
  ok: true;
  passwordChangedAt: string;
}

export interface PasswordResetRequestResponse {
  ok: true;
  message: string;
}

export interface ResetPasswordResponse {
  ok: true;
  message: string;
}
