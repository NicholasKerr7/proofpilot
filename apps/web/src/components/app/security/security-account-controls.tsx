"use client";

import { useState } from "react";
import type { SecurityOverview } from "@proofpilot/types";
import {
  Download,
  Fingerprint,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  PanelsTopLeft,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon
} from "lucide-react";
import { PasswordChangeForm } from "@/components/app/account/password-change-form";
import { formatSecurityDate } from "@/components/app/security/security-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface SecurityAccountControlsProps {
  onOpenReports: () => void;
  onPasswordChanged: (passwordChangedAt: string) => void;
  onReviewActivity: () => void;
  onSignOutOtherSessions: () => void;
  overview: SecurityOverview;
  portfolioDemo: boolean;
  revokingOtherSessions: boolean;
}

export function SecurityAccountControls({
  onOpenReports,
  onPasswordChanged,
  onReviewActivity,
  onSignOutOtherSessions,
  overview,
  portfolioDemo,
  revokingOtherSessions
}: SecurityAccountControlsProps) {
  const [isPasswordEditorOpen, setIsPasswordEditorOpen] = useState(false);
  const [twoFactorNotice, setTwoFactorNotice] = useState<string | null>(null);
  const otherSessionCount = overview.sessions.filter((session) => !session.isCurrent).length;

  return (
    <div className="grid gap-3">
      <SecurityControlSection title="Password">
        <ControlRow
          action={
            portfolioDemo ? (
              <Badge variant="secondary">Managed demo session</Badge>
            ) : (
              <Button
                aria-controls="security-password-editor"
                aria-expanded={isPasswordEditorOpen}
                onClick={() => setIsPasswordEditorOpen((current) => !current)}
                type="button"
                variant="outline"
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                {isPasswordEditorOpen ? "Close" : "Change password"}
              </Button>
            )
          }
          description={
            portfolioDemo
              ? "This temporary workspace uses a short-lived server session and resets automatically."
              : "Keep your account protected with a unique password."
          }
          icon={LockKeyhole}
          meta={
            portfolioDemo
              ? "Password changes disabled"
              : `Last changed ${formatSecurityDate(overview.passwordChangedAt)}`
          }
        />
        {!portfolioDemo && isPasswordEditorOpen ? (
          <div className="mt-4 border-t border-border pt-4" id="security-password-editor">
            <PasswordChangeForm onPasswordChanged={onPasswordChanged} />
          </div>
        ) : null}
      </SecurityControlSection>

      <SecurityControlSection title="Two-factor authentication">
        <ControlRow
          action={
            <Button
              onClick={() =>
                setTwoFactorNotice(
                  "Two-factor enrollment is not configured for this workspace yet."
                )
              }
              type="button"
              variant="outline"
            >
              Enable 2FA
            </Button>
          }
          description="Add a second verification step when signing in."
          icon={ShieldCheck}
          meta={overview.twoFactorEnabled ? "Enabled" : "Disabled"}
          metaTone={overview.twoFactorEnabled ? "success" : "warning"}
        />
        {twoFactorNotice ? (
          <p
            className="mt-3 flex items-start gap-2 rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100"
            role="status"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{twoFactorNotice}</span>
          </p>
        ) : null}
      </SecurityControlSection>

      <SecurityControlSection title="Biometric lock">
        <ControlRow
          action={
            <Switch
              aria-label="Biometric lock is unavailable"
              checked={overview.biometricEnabled}
              disabled={!overview.capabilities.biometricEnrollment}
              onCheckedChange={() => undefined}
            />
          }
          description="Biometric enrollment requires a verified WebAuthn provider and device flow."
          icon={Fingerprint}
          meta="Not configured"
          metaTone="secondary"
        />
      </SecurityControlSection>

      <SecurityControlSection title="Session management">
        <ControlRow
          action={
            <div className="grid gap-2">
              <Button onClick={onReviewActivity} type="button" variant="outline">
                Review sessions
              </Button>
              <Button
                disabled={!otherSessionCount || revokingOtherSessions}
                onClick={onSignOutOtherSessions}
                type="button"
                variant="outline"
              >
                {revokingOtherSessions ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                )}
                Sign out others
              </Button>
            </div>
          }
          description="Review active devices and end sessions you no longer recognize."
          icon={PanelsTopLeft}
          meta={`${otherSessionCount} other ${otherSessionCount === 1 ? "session" : "sessions"}`}
        />
      </SecurityControlSection>

      <SecurityControlSection title="Export permissions">
        <ControlRow
          action={
            <Button onClick={onOpenReports} type="button" variant="outline">
              Manage exports
            </Button>
          }
          description="Create owner-scoped case reports and control downloaded copies securely."
          icon={Download}
          meta="Authenticated exports only"
        />
      </SecurityControlSection>
    </div>
  );
}

function SecurityControlSection({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  const headingId = `security-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <section aria-labelledby={headingId} className="rounded-md border border-border bg-card p-4 md:p-5">
      <h2 className="text-sm font-semibold uppercase text-primary" id={headingId}>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

interface ControlRowProps {
  action: React.ReactNode;
  description: string;
  icon: LucideIcon;
  meta: string;
  metaTone?: "secondary" | "success" | "warning";
}

function ControlRow({
  action,
  description,
  icon: Icon,
  meta,
  metaTone = "secondary"
}: ControlRowProps) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
      <span className="flex h-14 w-14 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        <Badge className="mt-2" variant={metaTone}>
          {meta}
        </Badge>
      </div>
      <div className="col-span-2 sm:col-span-1">{action}</div>
    </div>
  );
}
