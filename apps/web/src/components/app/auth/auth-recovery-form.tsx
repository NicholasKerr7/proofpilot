"use client";

import { type FormEvent, useState } from "react";
import type {
  PasswordResetRequestResponse,
  ResetPasswordResponse
} from "@proofpilot/types";
import { ArrowLeft, ArrowRight, AtSign, CheckCircle2, KeyRound } from "lucide-react";
import { AuthPasswordField } from "@/components/app/auth/auth-password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/client/api";

interface AuthRecoveryFormProps {
  onBackToLogin: () => void;
  resetToken: string | null;
}

export function AuthRecoveryForm({
  onBackToLogin,
  resetToken
}: AuthRecoveryFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetComplete, setIsResetComplete] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (resetToken && password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (resetToken) {
        const response = await apiRequest<ResetPasswordResponse>("/api/auth/reset-password", {
          body: JSON.stringify({ newPassword: password, token: resetToken }),
          method: "POST"
        });
        setStatus(response.message);
        setIsResetComplete(true);
        setPassword("");
        setPasswordConfirmation("");
      } else {
        const response = await apiRequest<PasswordResetRequestResponse>(
          "/api/auth/request-password-reset",
          {
            body: JSON.stringify({ email: email.trim().toLowerCase() }),
            method: "POST"
          }
        );
        setStatus(response.message);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Password recovery failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isResetComplete) {
    return (
      <div className="grid gap-4">
        <div
          className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-teal-400/30 bg-teal-400/10 px-4 py-4 text-teal-100"
          role="status"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5" aria-hidden="true" />
          <p className="text-sm leading-6">{status}</p>
        </div>
        <Button onClick={onBackToLogin} size="lg" type="button">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          Sign in with new password
          <ArrowRight className="ml-auto h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <form aria-busy={isSubmitting} className="grid gap-4" onSubmit={handleSubmit}>
        {resetToken ? (
          <>
            <AuthPasswordField
              autoComplete="new-password"
              id="auth-reset-password"
              label="New password"
              name="newPassword"
              onChange={(event) => setPassword(event.target.value)}
              value={password}
            />
            <AuthPasswordField
              autoComplete="new-password"
              id="auth-reset-password-confirmation"
              label="Confirm new password"
              name="newPasswordConfirmation"
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              value={passwordConfirmation}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Use 8 to 120 characters and choose a password you have not used for this account.
            </p>
          </>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="auth-recovery-email">Email address</Label>
            <div className="relative">
              <AtSign
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
              />
              <Input
                autoCapitalize="none"
                autoComplete="email"
                className="min-h-12 pl-10"
                id="auth-recovery-email"
                maxLength={254}
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                spellCheck={false}
                type="email"
                value={email}
              />
            </div>
          </div>
        )}

        {error ? (
          <p
            className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {status ? (
          <p
            className="rounded-md border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-sm leading-6 text-teal-100"
            role="status"
          >
            {status}
          </p>
        ) : null}

        <Button disabled={isSubmitting} size="lg" type="submit">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          {isSubmitting
            ? "Working..."
            : resetToken
              ? "Reset password"
              : "Send reset link"}
          {!isSubmitting ? <ArrowRight className="ml-auto h-4 w-4" aria-hidden="true" /> : null}
        </Button>
      </form>

      <Button onClick={onBackToLogin} type="button" variant="ghost">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to sign in
      </Button>
    </div>
  );
}
