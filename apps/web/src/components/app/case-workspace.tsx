"use client";

import { useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Activity,
  CalendarDays,
  Clock3,
  FileArchive,
  ListChecks,
  PenLine,
  UploadCloud,
  UsersRound,
  type LucideIcon
} from "lucide-react";
import { ActivityPanel } from "@/components/app/activity/activity-panel";
import { CaseProgressRing } from "@/components/app/cases/case-progress-ring";
import {
  formatCaseDate,
  formatCaseReference,
  formatCaseStatus,
  getCaseNextActions,
  getCaseReadiness,
  getCaseStatusVariant,
  type CaseDestinationId
} from "@/components/app/cases/case-utils";
import { ChecklistPanel } from "@/components/app/checklist-panel";
import { EvidencePanel } from "@/components/app/evidence/evidence-panel";
import { PacketExportPanel } from "@/components/app/packet-export-panel";
import { ReminderPanel } from "@/components/app/reminder-panel";
import { StatementBuilder } from "@/components/app/statement-builder";
import { TimelinePanel } from "@/components/app/timeline-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CaseRecord } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface CaseWorkspaceProps {
  confirmBeforeDelete: boolean;
  onBackToCases: () => void;
  onCaseChanged: (caseId: string) => Promise<unknown>;
  onNotificationsChanged: () => void;
  onOpenCollaboration: () => void;
  selectedCase: CaseRecord | null;
}

export function CaseWorkspace({
  confirmBeforeDelete,
  onBackToCases,
  onCaseChanged,
  onNotificationsChanged,
  onOpenCollaboration,
  selectedCase
}: CaseWorkspaceProps) {
  const selectedCaseId = selectedCase?.id ?? null;
  const handleDocumentsChanged = useCallback(async () => {
    if (selectedCaseId) {
      await onCaseChanged(selectedCaseId);
    }
  }, [onCaseChanged, selectedCaseId]);

  if (!selectedCase) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Case workspace</CardTitle>
          <CardDescription>Select a case to review evidence, timeline, statement, and packet readiness.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border bg-secondary/35 p-5 text-sm text-muted-foreground">
            The workspace opens after a case is selected.
          </div>
        </CardContent>
      </Card>
    );
  }

  const readiness = getCaseReadiness(selectedCase);

  return (
    <div className="grid grid-cols-1 gap-5">
      <Card id="case-overview" className="scroll-mt-28 lg:scroll-mt-8">
        <CardContent className="grid gap-5 p-5 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-7 md:p-6">
          <CaseProgressRing
            className="order-2 justify-self-center md:order-1 md:justify-self-auto"
            value={readiness}
          />
          <div className="order-1 min-w-0 md:order-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button onClick={onBackToCases} size="sm" type="button" variant="ghost">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                All cases
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={onOpenCollaboration} size="sm" type="button" variant="outline">
                  <UsersRound className="h-4 w-4" aria-hidden="true" />
                  Collaborators
                </Button>
                <Badge>Primary case</Badge>
                <Badge variant={getCaseStatusVariant(selectedCase.status)}>
                  {formatCaseStatus(selectedCase.status)}
                </Badge>
              </div>
            </div>
            <h1 className="mt-4 break-words text-2xl font-semibold leading-9 md:text-3xl">
              {selectedCase.title}
            </h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {formatCaseReference(selectedCase)}
            </p>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {selectedCase.summary ?? "No summary added yet."}
            </p>
            <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Platform</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{selectedCase.platform}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Deadline</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {selectedCase.deadline ? formatCaseDate(selectedCase.deadline) : "Not set"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Case type</dt>
                <dd className="mt-1 break-words text-sm font-medium text-foreground">
                  {selectedCase.caseType.name}
                </dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      <nav
        className="flex gap-2 overflow-x-auto rounded-lg border border-border bg-card/70 p-1 scroll-container"
        aria-label="Case workspace sections"
      >
        {workspaceNavItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <NextActionsPanel readiness={readiness} selectedCase={selectedCase} />

      <div className="grid grid-cols-1 gap-5">
        <EvidencePanel
          confirmBeforeDelete={confirmBeforeDelete}
          selectedCase={selectedCase}
          onDocumentsChanged={handleDocumentsChanged}
        />

        <TimelinePanel
          key={`timeline-${selectedCase.id}`}
          selectedCase={selectedCase}
          onCaseChanged={onCaseChanged}
        />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <ChecklistPanel
          key={`checklist-${selectedCase.id}`}
          selectedCase={selectedCase}
          onCaseChanged={onCaseChanged}
        />

        <ReminderPanel
          confirmBeforeDelete={confirmBeforeDelete}
          key={`reminder-${selectedCase.id}`}
          onNotificationsChanged={onNotificationsChanged}
          selectedCase={selectedCase}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.55fr)]">
        <StatementBuilder onCaseChanged={onCaseChanged} selectedCase={selectedCase} />

        <PacketExportPanel
          onNotificationsChanged={onNotificationsChanged}
          onCaseChanged={onCaseChanged}
          readiness={readiness}
          selectedCase={selectedCase}
        />
      </div>

      <ActivityPanel key={`activity-${selectedCase.id}`} selectedCase={selectedCase} />
    </div>
  );
}

const workspaceNavItems = [
  { label: "Overview", href: "#case-overview" },
  { label: "Actions", href: "#next-actions" },
  { label: "Evidence", href: "#evidence-intake" },
  { label: "Timeline", href: "#case-timeline" },
  { label: "Checklist", href: "#evidence-checklist" },
  { label: "Statement", href: "#statement-builder" },
  { label: "Packet", href: "#packet-export" },
  { label: "Reminders", href: "#case-reminders" },
  { label: "Activity", href: "#case-activity" }
];

interface NextActionsPanelProps {
  readiness: number;
  selectedCase: CaseRecord;
}

const actionIcons: Record<CaseDestinationId, LucideIcon> = {
  "case-overview": FileArchive,
  "evidence-intake": UploadCloud,
  "case-timeline": Clock3,
  "evidence-checklist": ListChecks,
  "statement-builder": PenLine,
  "packet-export": FileArchive,
  "case-reminders": CalendarDays,
  "case-activity": Activity
};

function NextActionsPanel({ readiness, selectedCase }: NextActionsPanelProps) {
  const actions = getCaseNextActions(selectedCase);

  return (
    <Card id="next-actions" className="scroll-mt-28 lg:scroll-mt-8">
      <CardHeader className="md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-4">
        <div>
          <CardTitle>Next actions</CardTitle>
          <CardDescription>
            Fast links for the work most likely to improve this packet.
          </CardDescription>
        </div>
        <Badge variant={readiness >= 80 ? "success" : "warning"}>{readiness}% ready</Badge>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {actions.map((action) => {
          const ActionIcon = actionIcons[action.destinationId];

          return (
            <a
              key={action.destinationId}
              href={`#${action.destinationId}`}
              className={cn(
                "group grid min-h-28 grid-cols-[auto_1fr_auto] gap-3 rounded-md border border-border bg-secondary/35 p-3 text-left hover:bg-secondary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                action.wide ? "md:col-span-2" : null
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                <ActionIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{action.label}</span>
                  <Badge variant={action.variant}>{action.status}</Badge>
                </span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                  {action.detail}
                </span>
              </span>
              <ArrowRight
                className="mt-1 h-4 w-4 text-muted-foreground group-hover:text-foreground"
                aria-hidden="true"
              />
            </a>
          );
        })}
      </CardContent>
    </Card>
  );
}
