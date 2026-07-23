"use client";

import { useCallback, useState } from "react";
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
import { CaseCompletenessPanel } from "@/components/app/cases/case-completeness-panel";
import {
  formatCaseDate,
  formatCaseReference,
  formatCaseStatus,
  getCaseNextActions,
  getCaseCompleteness,
  getCaseStatusVariant,
  type CaseDestinationId
} from "@/components/app/cases/case-utils";
import { ChecklistPanel } from "@/components/app/checklist-panel";
import { EvidencePanel } from "@/components/app/evidence/evidence-panel";
import type { EvidenceCaptureState } from "@/components/app/evidence/evidence-panel";
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
  activeDestinationId: CaseDestinationId;
  confirmBeforeDelete: boolean;
  onBackToCases: () => void;
  onCaseChanged: (caseId: string) => Promise<unknown>;
  onNotificationsChanged: () => void;
  onOpenCollaboration: () => void;
  onOpenPacketShare: () => void;
  onSectionChange: (destinationId: CaseDestinationId) => void;
  portfolioDemo: boolean;
  selectedCase: CaseRecord | null;
}

export function CaseWorkspace({
  activeDestinationId,
  confirmBeforeDelete,
  onBackToCases,
  onCaseChanged,
  onNotificationsChanged,
  onOpenCollaboration,
  onOpenPacketShare,
  onSectionChange,
  portfolioDemo,
  selectedCase
}: CaseWorkspaceProps) {
  const [captureState, setCaptureState] = useState<EvidenceCaptureState>("idle");
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
          <CardDescription>Select a case to review evidence, timeline, statement, and packet completeness.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border bg-secondary/35 p-5 text-sm text-muted-foreground">
            The workspace opens after a case is selected.
          </div>
        </CardContent>
      </Card>
    );
  }

  const completeness = getCaseCompleteness(selectedCase);
  const completenessScore = completeness.score;
  const activeSection = workspaceNavItems.find(
    (item) => item.destinationId === activeDestinationId
  ) ?? workspaceNavItems[0];
  const isOverview = activeDestinationId === "case-overview";
  const canEdit = selectedCase.access?.canEdit ?? true;
  const canManage = selectedCase.access?.canManage ?? true;
  const accessLabel =
    selectedCase.access?.role === "EDITOR"
      ? "Shared editor"
      : selectedCase.access?.role === "VIEWER"
        ? "Shared viewer"
        : "Primary case";

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className={cn("grid gap-5", captureState !== "idle" ? "hidden" : null)}>
        {isOverview ? (
          <Card id="case-overview" className="proof-accent-frame scroll-mt-28 lg:scroll-mt-24">
            <CardContent className="p-4 sm:p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button onClick={onBackToCases} size="sm" type="button" variant="ghost">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  All cases
                </Button>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Badge variant={canManage ? "default" : "secondary"}>{accessLabel}</Badge>
                  <Badge variant={getCaseStatusVariant(selectedCase.status)}>
                    {formatCaseStatus(selectedCase.status)}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 md:gap-7">
                <div className="min-w-0">
                  <h1 className="break-words text-2xl font-semibold leading-8 md:text-3xl md:leading-10">
                    {selectedCase.title}
                  </h1>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {formatCaseReference(selectedCase)}
                  </p>
                </div>
                <CaseProgressRing label="Completeness" size="responsive" value={completenessScore} />
              </div>

              <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {selectedCase.summary ?? "No summary added yet."}
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Platform</dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">
                    {selectedCase.platform}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Deadline</dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">
                    {selectedCase.deadline ? formatCaseDate(selectedCase.deadline) : "Not set"}
                  </dd>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <dt className="text-xs text-muted-foreground">Case type</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-foreground">
                    {selectedCase.caseType.name}
                  </dd>
                </div>
              </dl>

              {canManage ? (
                <Button
                  className="mt-4 w-full sm:w-auto"
                  onClick={onOpenCollaboration}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <UsersRound className="h-4 w-4" aria-hidden="true" />
                  Collaborators
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <section className="proof-section-header grid gap-4 rounded-md border border-border bg-card px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:px-5">
            <Button
              aria-label="Back to case overview"
              onClick={() => onSectionChange("case-overview")}
              size="icon"
              title="Back to case overview"
              type="button"
              variant="ghost"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase text-primary">
                {selectedCase.title}
              </p>
              <h1 className="mt-1 text-2xl font-semibold leading-8">{activeSection.label}</h1>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {formatCaseReference(selectedCase)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <Badge variant={getCaseStatusVariant(selectedCase.status)}>
                {formatCaseStatus(selectedCase.status)}
              </Badge>
              <Badge variant={completenessScore >= 80 ? "success" : "secondary"}>
                {completenessScore}% complete
              </Badge>
            </div>
          </section>
        )}

        <nav
          className="proof-workspace-nav flex gap-1 overflow-x-auto rounded-md border border-border bg-card/80 p-1 scroll-container"
          aria-label="Case workspace sections"
        >
          {workspaceNavItems.map((item) => (
            <button
              key={item.destinationId}
              aria-current={activeDestinationId === item.destinationId ? "page" : undefined}
              onClick={() => onSectionChange(item.destinationId)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activeDestinationId === item.destinationId
                  ? "proof-nav-active text-foreground"
                  : null
              )}
              type="button"
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>

        {isOverview ? (
          <>
            <CaseCompletenessPanel
              completeness={completeness}
              onOpenCriterion={onSectionChange}
            />
            <NextActionsPanel
              onSectionChange={onSectionChange}
              completeness={completenessScore}
              selectedCase={selectedCase}
            />
          </>
        ) : null}
      </div>

      {activeDestinationId === "evidence-intake" ? (
        <EvidencePanel
          confirmBeforeDelete={confirmBeforeDelete}
          onCaptureStateChange={setCaptureState}
          onDocumentsChanged={handleDocumentsChanged}
          portfolioDemo={portfolioDemo}
          selectedCase={selectedCase}
        />
      ) : null}

      <div className={cn("grid grid-cols-1 gap-5", captureState !== "idle" ? "hidden" : null)}>
        {activeDestinationId === "case-timeline" ? (
          <TimelinePanel
            confirmBeforeDelete={confirmBeforeDelete}
            key={`timeline-${selectedCase.id}`}
            selectedCase={selectedCase}
            onCaseChanged={onCaseChanged}
            readOnly={!canEdit}
          />
        ) : null}
        {activeDestinationId === "evidence-checklist" ? (
          <ChecklistPanel
            key={`checklist-${selectedCase.id}`}
            selectedCase={selectedCase}
            onCaseChanged={onCaseChanged}
            readOnly={!canEdit}
          />
        ) : null}
        {activeDestinationId === "case-reminders" ? (
          <ReminderPanel
            confirmBeforeDelete={confirmBeforeDelete}
            key={`reminder-${selectedCase.id}`}
            onNotificationsChanged={onNotificationsChanged}
            readOnly={!canEdit}
            selectedCase={selectedCase}
          />
        ) : null}
        {activeDestinationId === "statement-builder" ? (
          <StatementBuilder
            onCaseChanged={onCaseChanged}
            readOnly={!canEdit}
            selectedCase={selectedCase}
          />
        ) : null}
        {activeDestinationId === "packet-export" ? (
          <PacketExportPanel
            onNotificationsChanged={onNotificationsChanged}
            onCaseChanged={onCaseChanged}
            onOpenPacketShare={onOpenPacketShare}
            completeness={completenessScore}
            selectedCase={selectedCase}
          />
        ) : null}
        {activeDestinationId === "case-activity" ? (
          <ActivityPanel key={`activity-${selectedCase.id}`} selectedCase={selectedCase} />
        ) : null}
      </div>
    </div>
  );
}

const workspaceNavItems = [
  { label: "Overview", destinationId: "case-overview", icon: FileArchive },
  { label: "Evidence", destinationId: "evidence-intake", icon: UploadCloud },
  { label: "Timeline", destinationId: "case-timeline", icon: Clock3 },
  { label: "Checklist", destinationId: "evidence-checklist", icon: ListChecks },
  { label: "Statement", destinationId: "statement-builder", icon: PenLine },
  { label: "Packet", destinationId: "packet-export", icon: FileArchive },
  { label: "Reminders", destinationId: "case-reminders", icon: CalendarDays },
  { label: "Activity", destinationId: "case-activity", icon: Activity }
] satisfies Array<{
  destinationId: CaseDestinationId;
  icon: LucideIcon;
  label: string;
}>;

interface NextActionsPanelProps {
  onSectionChange: (destinationId: CaseDestinationId) => void;
  completeness: number;
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

function NextActionsPanel({
  onSectionChange,
  completeness,
  selectedCase
}: NextActionsPanelProps) {
  const actions = getCaseNextActions(selectedCase);

  return (
    <Card id="next-actions" className="scroll-mt-28 lg:scroll-mt-24">
      <CardHeader className="md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-4">
        <div>
          <CardTitle>Next actions</CardTitle>
          <CardDescription>
            Fast links for the work most likely to improve this packet.
          </CardDescription>
        </div>
        <Badge variant={completeness >= 80 ? "success" : "warning"}>
          {completeness}% complete
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => {
          const ActionIcon = actionIcons[action.destinationId];

          return (
            <button
              key={action.destinationId}
              onClick={() => onSectionChange(action.destinationId)}
              className={cn(
                "proof-interactive-surface group grid min-h-28 grid-cols-[auto_1fr_auto] gap-3 rounded-md border border-border bg-secondary/35 p-3 text-left hover:bg-secondary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                action.wide ? "md:col-span-2 xl:col-span-1" : null
              )}
              type="button"
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
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
