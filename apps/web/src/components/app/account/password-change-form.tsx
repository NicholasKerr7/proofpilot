"use client";

import { type FormEvent, useState } from "react";
import type { ChangePasswordResponse } from "@proofpilot/types";
import { KeyRound } from "lucide-react";
import { AuthPasswordField } from "@/components/app/auth/auth-password-field";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/client/api";

interface PasswordChangeFormProps {
  onPasswordChanged?: (passwordChangedAt: string) => void;
}

export function PasswordChangeForm({ onPasswordChanged }: PasswordChangeFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (newPassword !== confirmPassword) {
      setFeedback({ kind: "error", message: "New passwords do not match." });
      return;
    }

    if (currentPassword === newPassword) {
      setFeedback({
        kind: "error",
        message: "Choose a password that differs from your current password."
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiRequest<ChangePasswordResponse>("/api/auth/change-password", {
        body: JSON.stringify({ currentPassword, newPassword }),
        method: "POST"
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback({ kind: "success", message: "Password changed." });
      onPasswordChanged?.(response.passwordChangedAt);
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Password could not be changed."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <AuthPasswordField
        autoComplete="current-password"
        disabled={isSubmitting}
        id="current-password"
        label="Current password"
        name="currentPassword"
        onChange={(event) => {
          setCurrentPassword(event.target.value);
          setFeedback(null);
        }}
        value={currentPassword}
      />
      <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
        <AuthPasswordField
          autoComplete="new-password"
          disabled={isSubmitting}
          id="new-password"
          label="New password"
          name="newPassword"
          onChange={(event) => {
            setNewPassword(event.target.value);
            setFeedback(null);
          }}
          value={newPassword}
        />
        <AuthPasswordField
          autoComplete="new-password"
          disabled={isSubmitting}
          id="confirm-password"
          label="Confirm new password"
          name="confirmPassword"
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setFeedback(null);
          }}
          value={confirmPassword}
        />
      </div>

      <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div aria-live="polite">
          {feedback ? (
            <p
              className={
                feedback.kind === "success" ? "text-sm text-teal-200" : "text-sm text-red-200"
              }
              role={feedback.kind === "error" ? "alert" : "status"}
            >
              {feedback.message}
            </p>
          ) : null}
        </div>
        <Button disabled={isSubmitting} type="submit">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          {isSubmitting ? "Updating..." : "Change password"}
        </Button>
      </div>
    </form>
  );
}
