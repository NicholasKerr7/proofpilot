"use client";

import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  CalendarClock,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileArchive,
  FolderOpen,
  ListChecks,
  PenLine,
  Plus,
  ShieldCheck,
  Search,
  Settings2,
  UploadCloud,
  UserRound,
  type LucideIcon
} from "lucide-react";
import type { AccountSection } from "@/components/app/account/account-panel";
import {
  formatMemberSince,
  getUserInitials
} from "@/components/app/account/account-utils";
import type { CaseDestinationId } from "@/components/app/cases/case-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuthUser, CaseRecord } from "@/lib/client/types";

const caseCommands: Array<{
  destinationId: CaseDestinationId;
  icon: LucideIcon;
  label: string;
}> = [
  { destinationId: "evidence-intake", icon: UploadCloud, label: "Evidence" },
  { destinationId: "case-timeline", icon: Clock3, label: "Timeline" },
  { destinationId: "evidence-checklist", icon: ListChecks, label: "Checklist" },
  { destinationId: "statement-builder", icon: PenLine, label: "Statement" },
  { destinationId: "packet-export", icon: FileArchive, label: "Packet" },
  { destinationId: "case-reminders", icon: CalendarClock, label: "Reminders" },
  { destinationId: "case-activity", icon: Activity, label: "Activity" }
];

interface MoreMenuProps {
  onCreateCase: () => void;
  onOpenAccount: (section: AccountSection) => void;
  onOpenCalendar: () => void;
  onOpenCase: (caseId: string, destinationId: CaseDestinationId) => Promise<void>;
  onOpenHelp: () => void;
  onOpenNotifications: () => void;
  onOpenReports: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onViewCases: () => void;
  selectedCase: CaseRecord | null;
  user: AuthUser;
}

export function MoreMenu({
  onCreateCase,
  onOpenAccount,
  onOpenCalendar,
  onOpenCase,
  onOpenHelp,
  onOpenNotifications,
  onOpenReports,
  onOpenSearch,
  onOpenSettings,
  onViewCases,
  selectedCase,
  user
}: MoreMenuProps) {
  return (
    <section aria-labelledby="more-menu-heading" className="grid gap-5">
      <div>
        <p className="text-sm font-semibold text-primary">Workspace navigation</p>
        <h1 id="more-menu-heading" className="mt-1 text-2xl font-semibold sm:text-3xl">
          More
        </h1>
      </div>

      <Card className="border-primary/45">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center md:p-6">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/55 bg-primary/10 text-xl font-semibold text-primary">
            {getUserInitials(user)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-lg font-semibold">{user.name ?? "ProofPilot user"}</h2>
              <Badge variant="secondary">Account owner</Badge>
            </div>
            <p className="mt-1 break-all text-sm text-muted-foreground">{user.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Member since {formatMemberSince(user.createdAt)}
            </p>
          </div>
          <Button onClick={() => onOpenAccount("profile")} type="button" variant="outline">
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Manage profile
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <MoreDestination
              detail="Update your name and review account details."
              icon={UserRound}
              label="Profile"
              onClick={() => onOpenAccount("profile")}
            />
            <MoreDestination
              detail="Change the password for your account."
              icon={ShieldCheck}
              label="Security"
              onClick={() => onOpenAccount("security")}
            />
            <MoreDestination
              detail="Manage app preferences, notifications, appearance, and sync."
              icon={Settings2}
              label="Settings"
              onClick={onOpenSettings}
            />
            <MoreDestination
              detail="Search guides, read articles, and contact support."
              icon={CircleHelp}
              label="Help Center"
              onClick={onOpenHelp}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <MoreDestination
              detail="Review and manage every appeal case."
              icon={FolderOpen}
              label="All cases"
              onClick={onViewCases}
            />
            <MoreDestination
              detail="Start another account appeal packet."
              icon={Plus}
              label="Create case"
              onClick={onCreateCase}
            />
            <MoreDestination
              detail="Review case updates and processing results."
              icon={Bell}
              label="Inbox"
              onClick={onOpenNotifications}
            />
            <MoreDestination
              detail="Review deadlines and scheduled reminders across active cases."
              icon={CalendarDays}
              label="Calendar & deadlines"
              onClick={onOpenCalendar}
            />
            <MoreDestination
              detail="Find cases, evidence, timelines, packets, and support requests."
              icon={Search}
              label="Search"
              onClick={onOpenSearch}
            />
            <MoreDestination
              detail="Compare current readiness and export case data."
              icon={BarChart3}
              label="Reports"
              onClick={onOpenReports}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-start">
          <div>
            <CardTitle>Active case tools</CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {selectedCase?.title ?? "No case selected"}
            </p>
          </div>
          {selectedCase ? <Badge variant="secondary">{selectedCase.platform}</Badge> : null}
        </CardHeader>
        <CardContent>
          {selectedCase ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {caseCommands.map((command) => (
                <Button
                  key={command.destinationId}
                  className={
                    command.destinationId === "case-activity"
                      ? "col-span-2 justify-start sm:col-span-1"
                      : "justify-start"
                  }
                  onClick={() => {
                    void onOpenCase(selectedCase.id, command.destinationId);
                  }}
                  type="button"
                  variant="outline"
                >
                  <command.icon className="h-4 w-4" aria-hidden="true" />
                  {command.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border bg-secondary/25 px-3 py-4 text-sm text-muted-foreground">
              Select a case to open its evidence, timeline, checklist, statement, and packet tools.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

interface MoreDestinationProps {
  detail: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

function MoreDestination({ detail, icon: Icon, label, onClick }: MoreDestinationProps) {
  return (
    <button
      className="group grid min-h-18 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-secondary/25 p-3 text-left hover:bg-secondary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
      type="button"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight
        className="h-4 w-4 text-muted-foreground group-hover:text-foreground"
        aria-hidden="true"
      />
    </button>
  );
}
