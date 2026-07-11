"use client";

import { useCallback } from "react";
import {
  ArrowRight,
  Clock3,
  FileArchive,
  ListChecks,
  PenLine,
  UploadCloud,
  type LucideIcon
} from "lucide-react";
import { ChecklistPanel } from "@/components/app/checklist-panel";
import { EvidencePanel } from "@/components/app/evidence/evidence-panel";
import { PacketExportPanel } from "@/components/app/packet-export-panel";
import { ReminderPanel } from "@/components/app/reminder-panel";
import { StatementBuilder } from "@/components/app/statement-builder";
import { TimelinePanel } from "@/components/app/timeline-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CaseRecord } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface CaseWorkspaceProps {
  onCaseChanged: (caseId: string) => Promise<unknown>;
  onNotificationsChanged: () => void;
  selectedCase: CaseRecord | null;
}

export function CaseWorkspace({
  onCaseChanged,
  onNotificationsChanged,
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

  const readiness = getReadiness(selectedCase);

  return (
    <div className="grid grid-cols-1 gap-5">
      <Card id="case-overview" className="scroll-mt-28 lg:scroll-mt-8">
        <CardHeader className="md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge>{selectedCase.platform}</Badge>
              <Badge variant="secondary">{selectedCase.caseType.name}</Badge>
            </div>
            <CardTitle className="text-xl md:text-2xl">{selectedCase.title}</CardTitle>
            <CardDescription>{selectedCase.summary ?? "No summary added yet."}</CardDescription>
          </div>
          <div className="min-w-52 rounded-md border border-border bg-secondary/35 p-3">
            <Progress value={readiness} label="Packet readiness" />
          </div>
        </CardHeader>
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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <EvidencePanel
          selectedCase={selectedCase}
          onDocumentsChanged={handleDocumentsChanged}
        />

        <TimelinePanel selectedCase={selectedCase} onCaseChanged={onCaseChanged} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ChecklistPanel selectedCase={selectedCase} onCaseChanged={onCaseChanged} />

        <ReminderPanel
          key={selectedCase.id}
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
  { label: "Packet", href: "#packet-export" }
];

interface NextActionsPanelProps {
  readiness: number;
  selectedCase: CaseRecord;
}

type NextAction = {
  detail: string;
  href: string;
  icon: LucideIcon;
  label: string;
  status: string;
  variant: "secondary" | "success" | "warning";
  wide?: boolean;
};

function NextActionsPanel({ readiness, selectedCase }: NextActionsPanelProps) {
  const actions = getNextActions(selectedCase, readiness);

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
        {actions.map((action) => (
          <a
            key={action.href}
            href={action.href}
            className={cn(
              "group grid min-h-28 grid-cols-[auto_1fr_auto] gap-3 rounded-md border border-border bg-secondary/35 p-3 text-left hover:bg-secondary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              action.wide ? "md:col-span-2" : null
            )}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
              <action.icon className="h-5 w-5" aria-hidden="true" />
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
        ))}
      </CardContent>
    </Card>
  );
}

function isChecklistReady(status: string) {
  return status === "FOUND" || status === "COMPLETE";
}

function getNextActions(caseRecord: CaseRecord, readiness: number): NextAction[] {
  const documentCount = caseRecord._count?.documents ?? 0;
  const eventCount = caseRecord.events?.length ?? caseRecord._count?.events ?? 0;
  const checklistItems = caseRecord.checklist ?? [];
  const completedChecklistItems = checklistItems.filter((item) => isChecklistReady(item.status));
  const missingChecklistItems = Math.max(0, checklistItems.length - completedChecklistItems.length);
  const hasStatement = Boolean(caseRecord.summary || caseRecord._count?.statements);

  return [
    {
      detail: "Upload notices, support threads, statements, and account ownership proof.",
      href: "#evidence-intake",
      icon: UploadCloud,
      label: "Add evidence",
      status: documentCount ? `${documentCount} files` : "Start here",
      variant: documentCount ? "success" : "warning"
    },
    {
      detail: "Review missing requirements and matched evidence before generating a packet.",
      href: "#evidence-checklist",
      icon: ListChecks,
      label: "Close checklist gaps",
      status: missingChecklistItems ? `${missingChecklistItems} missing` : "Ready",
      variant: missingChecklistItems ? "warning" : "success"
    },
    {
      detail: "Confirm the sequence of notices, support contact, drafts, and platform responses.",
      href: "#case-timeline",
      icon: Clock3,
      label: "Verify timeline",
      status: eventCount ? `${eventCount} events` : "Draft",
      variant: eventCount ? "secondary" : "warning"
    },
    {
      detail: "Draft or refine the appeal statement using the evidence and timeline.",
      href: "#statement-builder",
      icon: PenLine,
      label: "Prepare statement",
      status: hasStatement ? "Draft ready" : "Needs draft",
      variant: hasStatement ? "success" : "warning"
    },
    {
      detail: "Generate the final case packet after evidence, checklist, and statement review.",
      href: "#packet-export",
      icon: FileArchive,
      label: "Generate packet",
      status: readiness >= 80 ? "Ready" : `${readiness}% ready`,
      variant: readiness >= 80 ? "success" : "secondary",
      wide: true
    }
  ];
}

function getReadiness(caseRecord: CaseRecord) {
  const documentScore = Math.min(40, (caseRecord._count?.documents ?? 0) * 10);
  const eventScore = Math.min(25, (caseRecord._count?.events ?? 0) * 8);
  const checklistItems = caseRecord.checklist ?? [];
  const completedChecklistItems = checklistItems.filter((item) => isChecklistReady(item.status));
  const checklistScore = checklistItems.length
    ? Math.round((completedChecklistItems.length / checklistItems.length) * 25)
    : 0;
  const statementScore = caseRecord.summary || caseRecord._count?.statements ? 10 : 0;

  return documentScore + eventScore + checklistScore + statementScore;
}
