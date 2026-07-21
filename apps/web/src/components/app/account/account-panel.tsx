"use client";

import type { KeyboardEvent } from "react";
import {
  CalendarClock,
  FileText,
  FolderOpen,
  ShieldCheck,
  UserRound,
  type LucideIcon
} from "lucide-react";
import { ProfileForm } from "@/components/app/account/profile-form";
import {
  formatMemberSince,
  getAccountCaseMetrics,
  getUserInitials
} from "@/components/app/account/account-utils";
import { SecurityForm } from "@/components/app/account/security-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AuthUser, CaseRecord } from "@/lib/client/types";
import { getTabKeyboardTarget } from "@/lib/tab-keyboard-navigation";
import { cn } from "@/lib/utils";

export type AccountSection = "profile" | "security";

interface AccountPanelProps {
  cases: CaseRecord[];
  onSectionChange: (section: AccountSection) => void;
  onUserChanged: (user: AuthUser) => void;
  section: AccountSection;
  user: AuthUser;
}

const accountTabs = [
  { id: "profile" as const, icon: UserRound, label: "Profile" },
  { id: "security" as const, icon: ShieldCheck, label: "Security" }
];

export function AccountPanel({
  cases,
  onSectionChange,
  onUserChanged,
  section,
  user
}: AccountPanelProps) {
  const metrics = getAccountCaseMetrics(cases);

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentSection: AccountSection
  ) {
    const nextSection = getTabKeyboardTarget(
      accountTabs.map((tab) => tab.id),
      currentSection,
      event.key
    );

    if (!nextSection) {
      return;
    }

    event.preventDefault();
    onSectionChange(nextSection);
    document.getElementById(`account-${nextSection}-tab`)?.focus();
  }

  return (
    <section aria-labelledby="account-heading" className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Private workspace</p>
          <h1 id="account-heading" className="mt-1 text-2xl font-semibold sm:text-3xl">
            Account
          </h1>
        </div>

        <div
          aria-label="Account sections"
          className="grid w-full grid-cols-2 rounded-md border border-border bg-card p-1 sm:w-auto sm:min-w-64"
          role="tablist"
        >
          {accountTabs.map((tab) => (
            <button
              key={tab.id}
              aria-controls="account-section-panel"
              aria-selected={section === tab.id}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                section === tab.id ? "bg-secondary text-primary" : null
              )}
              id={`account-${tab.id}-tab`}
              onClick={() => onSectionChange(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
              role="tab"
              tabIndex={section === tab.id ? 0 : -1}
              type="button"
            >
              <tab.icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="border-primary/45">
        <CardContent className="grid gap-5 p-5 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:p-6">
          <span className="flex h-24 w-24 items-center justify-center rounded-full border border-primary/60 bg-primary/10 text-3xl font-semibold text-primary md:h-28 md:w-28 md:text-4xl">
            {getUserInitials(user)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-xl font-semibold md:text-2xl">
                {user.name ?? "ProofPilot user"}
              </h2>
              <Badge variant="secondary">Account owner</Badge>
            </div>
            <p className="mt-2 break-all text-sm text-muted-foreground">{user.email}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Member since {formatMemberSince(user.createdAt)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <AccountMetric icon={FolderOpen} label="Total cases" value={metrics.totalCases} />
        <AccountMetric icon={ShieldCheck} label="Active cases" value={metrics.activeCases} />
        <AccountMetric icon={FileText} label="Evidence files" value={metrics.evidenceFiles} />
        <AccountMetric
          icon={CalendarClock}
          label="Upcoming deadlines"
          value={metrics.upcomingDeadlines}
        />
      </div>

      <div
        aria-labelledby={`account-${section}-tab`}
        id="account-section-panel"
        role="tabpanel"
      >
        {section === "profile" ? (
          <ProfileForm onUserChanged={onUserChanged} user={user} />
        ) : (
          <SecurityForm />
        )}
      </div>
    </section>
  );
}

interface AccountMetricProps {
  icon: LucideIcon;
  label: string;
  value: number;
}

function AccountMetric({ icon: Icon, label, value }: AccountMetricProps) {
  return (
    <Card>
      <CardContent className="grid min-h-28 content-between gap-3 p-4">
        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
