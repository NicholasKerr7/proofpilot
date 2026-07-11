"use client";

import { type FormEvent, useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { AuthPasswordField } from "@/components/app/auth/auth-password-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/client/api";

export function SecurityForm() {
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
      await apiRequest<{ ok: true }>("/api/auth/change-password", {
        body: JSON.stringify({ currentPassword, newPassword }),
        method: "POST"
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback({ kind: "success", message: "Password changed." });
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
    <div className="grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Confirm your current password before setting a new one.</CardDescription>
        </CardHeader>
        <CardContent>
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
                      feedback.kind === "success"
                        ? "text-sm text-teal-200"
                        : "text-sm text-red-200"
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password guidance</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <GuidanceItem text="Use at least 8 characters." />
          <GuidanceItem text="Choose a password you do not use elsewhere." />
          <GuidanceItem text="Your current browser stays signed in after the change." />
        </CardContent>
      </Card>
    </div>
  );
}

function GuidanceItem({ text }: { text: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 text-teal-300" aria-hidden="true" />
      <p className="text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}
