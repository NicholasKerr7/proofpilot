"use client";

import { type FormEvent, useState } from "react";
import { Mail, Save, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/client/api";
import type { AuthUser } from "@/lib/client/types";

interface ProfileFormProps {
  onUserChanged: (user: AuthUser) => void;
  user: AuthUser;
}

export function ProfileForm({ onUserChanged, user }: ProfileFormProps) {
  const [name, setName] = useState(user.name ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);

  const normalizedName = name.trim();
  const hasChanges = normalizedName !== (user.name ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!normalizedName) {
      setFeedback({ kind: "error", message: "Enter your full name." });
      return;
    }

    setIsSubmitting(true);

    try {
      const updatedUser = await apiRequest<AuthUser>("/api/auth/me", {
        body: JSON.stringify({ name: normalizedName }),
        method: "PATCH"
      });
      onUserChanged(updatedUser);
      setFeedback({ kind: "success", message: "Profile saved." });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Profile could not be saved."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile details</CardTitle>
        <CardDescription>Your name appears throughout your private workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="account-name">Full name</Label>
            <div className="relative">
              <UserRound
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
              />
              <Input
                autoComplete="name"
                className="min-h-12 pl-10"
                disabled={isSubmitting}
                id="account-name"
                maxLength={120}
                name="name"
                onChange={(event) => {
                  setName(event.target.value);
                  setFeedback(null);
                }}
                required
                value={name}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="account-email">Email address</Label>
            <div className="relative">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                autoComplete="email"
                className="min-h-12 pl-10 text-muted-foreground"
                id="account-email"
                readOnly
                value={user.email}
              />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Email changes are not available in this release.
            </p>
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
            <Button disabled={isSubmitting || !hasChanges || !normalizedName} type="submit">
              <Save className="h-4 w-4" aria-hidden="true" />
              {isSubmitting ? "Saving..." : "Save profile"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
