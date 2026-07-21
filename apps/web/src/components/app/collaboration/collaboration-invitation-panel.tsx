"use client";

import type { CaseInvitationPreview } from "@proofpilot/types";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Eye,
  FilePenLine,
  LogIn,
  ShieldCheck,
  UserRoundCheck,
  X
} from "lucide-react";
import type { AuthMode } from "@/components/app/auth-panel";
import { AuthBrand } from "@/components/app/auth/auth-brand";
import { ApiStatus } from "@/components/system/api-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { AuthUser } from "@/lib/client/types";

interface CollaborationInvitationPanelProps {
  error: string | null;
  invitation: CaseInvitationPreview | null;
  isLoading: boolean;
  isSubmitting: boolean;
  onAccept: () => Promise<void>;
  onAuthenticate: (mode: AuthMode) => void;
  onDecline: () => Promise<void>;
  onDismiss: () => void;
  onSwitchAccount: () => Promise<void>;
  user: AuthUser | null;
}

export function CollaborationInvitationPanel({
  error,
  invitation,
  isLoading,
  isSubmitting,
  onAccept,
  onAuthenticate,
  onDecline,
  onDismiss,
  onSwitchAccount,
  user
}: CollaborationInvitationPanelProps) {
  const isExpired = invitation?.status === "EXPIRED";
  const emailMatches =
    Boolean(user && invitation) &&
    user?.email.toLowerCase() === invitation?.invitedEmail.toLowerCase();
  const RoleIcon = invitation?.role === "EDITOR" ? FilePenLine : Eye;

  return (
    <main className="grid min-h-[100svh] items-center bg-black/30 px-4 py-5 sm:px-6 md:px-8 md:py-8">
      <section
        aria-labelledby="collaboration-invitation-heading"
        className="mx-auto w-full max-w-2xl"
      >
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <AuthBrand />
          <ApiStatus />
        </div>

        <Card className="proof-accent-frame overflow-hidden">
          <CardHeader className="gap-5 p-5 sm:p-7 md:p-8 md:pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge>Secure case invitation</Badge>
              {invitation ? (
                <Badge variant={isExpired ? "danger" : "secondary"}>
                  {isExpired ? "Expired" : invitation.role === "EDITOR" ? "Editor" : "Viewer"}
                </Badge>
              ) : null}
            </div>

            <div>
              <h1
                className="break-words text-2xl font-semibold leading-8 text-foreground sm:text-3xl"
                id="collaboration-invitation-heading"
              >
                {isLoading
                  ? "Loading invitation"
                  : invitation
                    ? `Join ${invitation.caseTitle}`
                    : "Invitation unavailable"}
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {invitation
                  ? `${invitation.ownerName} invited you to collaborate in ProofPilot.`
                  : "This invitation could not be opened."}
              </p>
            </div>
          </CardHeader>

          <CardContent className="grid gap-5 p-5 pt-0 sm:p-7 sm:pt-0 md:p-8 md:pt-0">
            {isLoading ? (
              <div className="grid min-h-36 place-items-center rounded-md border border-border bg-secondary/25 text-sm text-muted-foreground">
                Verifying secure invitation...
              </div>
            ) : null}

            {invitation ? (
              <dl className="grid gap-0 overflow-hidden rounded-md border border-border bg-secondary/20 sm:grid-cols-3">
                <InvitationDetail
                  icon={RoleIcon}
                  label="Access"
                  value={invitation.role === "EDITOR" ? "Edit case" : "View case"}
                />
                <InvitationDetail
                  icon={UserRoundCheck}
                  label="Invited account"
                  value={invitation.invitedEmail}
                />
                <InvitationDetail
                  icon={Clock3}
                  label="Expires"
                  value={formatInvitationDate(invitation.expiresAt)}
                />
              </dl>
            ) : null}

            {error ? (
              <p
                className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            {invitation && !isExpired ? (
              <div className="rounded-md border border-primary/25 bg-primary/10 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Account verification required</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Access can only be accepted by {invitation.invitedEmail}. The invitation is
                      single-use and will be removed after a decision.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {!isLoading && invitation && isExpired ? (
              <div className="flex items-start gap-3 rounded-md border border-amber-300/30 bg-amber-300/10 p-4">
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
                <p className="text-sm leading-6 text-amber-100">
                  Ask the case owner to send a new invitation.
                </p>
              </div>
            ) : null}

            {!isLoading && invitation && !isExpired && !user ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Button onClick={() => onAuthenticate("login")} size="lg" type="button">
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Sign in to review
                </Button>
                <Button
                  onClick={() => onAuthenticate("register")}
                  size="lg"
                  type="button"
                  variant="outline"
                >
                  <UserRoundCheck className="h-4 w-4" aria-hidden="true" />
                  Create invited account
                </Button>
              </div>
            ) : null}

            {!isLoading && invitation && !isExpired && user && !emailMatches ? (
              <div className="grid gap-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  You are signed in as <span className="font-medium text-foreground">{user.email}</span>.
                  Switch to the invited account to continue.
                </p>
                <Button
                  disabled={isSubmitting}
                  onClick={() => void onSwitchAccount()}
                  size="lg"
                  type="button"
                  variant="outline"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Switch account
                </Button>
              </div>
            ) : null}

            {!isLoading && invitation && !isExpired && user && emailMatches ? (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Button
                  disabled={isSubmitting}
                  onClick={() => void onAccept()}
                  size="lg"
                  type="button"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  {isSubmitting ? "Accepting..." : "Accept invitation"}
                </Button>
                <Button
                  disabled={isSubmitting}
                  onClick={() => void onDecline()}
                  size="lg"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Decline
                </Button>
              </div>
            ) : null}

            {!isLoading && (!invitation || isExpired) ? (
              <Button onClick={onDismiss} type="button" variant="outline">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Return to ProofPilot
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

interface InvitationDetailProps {
  icon: typeof Clock3;
  label: string;
  value: string;
}

function InvitationDetail({ icon: Icon, label, value }: InvitationDetailProps) {
  return (
    <div className="min-w-0 border-b border-border p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function formatInvitationDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}
