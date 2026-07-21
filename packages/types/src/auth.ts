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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ChangePasswordResponse {
  ok: true;
  passwordChangedAt: string;
}
