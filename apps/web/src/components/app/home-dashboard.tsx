"use client";

import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  FileArchive,
  FileText,
  FolderOpen,
  ListChecks,
  PenLine,
  Plus,
  TriangleAlert,
  UploadCloud,
  type LucideIcon
} from "lucide-react";
import { CaseProgressRing } from "@/components/app/cases/case-progress-ring";
import {
  formatCaseDate,
  formatCaseReference,
  formatCaseStatus,
  getCaseNextActions,
  getCaseProgressMessage,
  getCaseReadiness,
  getCaseStatusVariant,
  getCompletedChecklistCount,
  getMissingChecklistCount,
  isChecklistReady,
  type CaseDestinationId
} from "@/components/app/cases/case-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CaseRecord } from "@/lib/client/types";

interface HomeDashboardProps {
  cases: CaseRecord[];
  onCreateCase: () => void;
  onOpenCase: (caseId: string, destinationId?: CaseDestinationId) => Promise<void>;
  onViewCases: () => void;
  primaryCase: CaseRecord | null;
}

const actionIcons: Record<CaseDestinationId, LucideIcon> = {
  "case-overview": FolderOpen,
  "evidence-intake": UploadCloud,
  "case-timeline": Clock3,
  "evidence-checklist": ListChecks,
  "statement-builder": PenLine,
  "packet-export": FileArchive,
  "case-reminders": CalendarDays,
  "case-activity": Activity
};

export function HomeDashboard({
  cases,
  onCreateCase,
  onOpenCase,
  onViewCases,
  primaryCase
}: HomeDashboardProps) {
  if (!primaryCase) {
    return (
      <section aria-labelledby="home-dashboard-heading" className="grid gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Case command center</p>
            <h1 id="home-dashboard-heading" className="mt-1 text-2xl font-semibold sm:text-3xl">
              Start your first appeal case
            </h1>
          </div>
        </div>
        <Card>
          <CardContent className="grid min-h-72 place-items-center p-6 text-center">
            <div className="max-w-md">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                <FolderOpen className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-lg font-semibold">No active cases yet</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Create a private case to organize evidence, review missing proof, and build the packet.
              </p>
              <Button className="mt-5" onClick={onCreateCase} type="button">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create case
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  const readiness = getCaseReadiness(primaryCase);
  const metrics = getCaseMetrics(primaryCase);
  const actions = getCaseNextActions(primaryCase).slice(0, 3);
  const recentEvents = [...(primaryCase.events ?? [])]
    .sort(
      (first, second) =>
        new Date(second.occurredAt).getTime() - new Date(first.occurredAt).getTime()
    )
    .slice(0, 4);

  return (
    <section aria-labelledby="home-dashboard-heading" className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Case command center</p>
          <h1 id="home-dashboard-heading" className="mt-1 text-2xl font-semibold sm:text-3xl">
            Home
          </h1>
        </div>
        <Button onClick={onViewCases} type="button" variant="outline">
          <FolderOpen className="h-4 w-4" aria-hidden="true" />
          {cases.length} {cases.length === 1 ? "case" : "cases"}
        </Button>
      </div>

      <Card className="proof-accent-frame">
        <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-5 p-5 md:grid-cols-[minmax(0,1.35fr)_auto_minmax(13rem,0.7fr)] md:items-center md:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Primary case</Badge>
              <Badge variant={getCaseStatusVariant(primaryCase.status)}>
                {formatCaseStatus(primaryCase.status)}
              </Badge>
            </div>
            <h2 className="mt-3 break-words text-xl font-semibold leading-8 md:text-2xl">
              {primaryCase.title}
            </h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {formatCaseReference(primaryCase)}
            </p>
            <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Deadline</dt>
                <dd className="mt-1 text-sm font-medium">
                  {primaryCase.deadline ? formatCaseDate(primaryCase.deadline) : "No deadline set"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Platform</dt>
                <dd className="mt-1 text-sm font-medium">{primaryCase.platform}</dd>
              </div>
            </dl>
          </div>

          <CaseProgressRing value={readiness} />

          <div className="col-span-2 border-t border-border pt-4 md:col-span-1 md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <p className="text-sm font-semibold text-foreground">Keep building the case</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {getCaseProgressMessage(readiness)}
            </p>
            <Button
              className="mt-4 w-full"
              onClick={() => {
                void onOpenCase(primaryCase.id, "case-overview");
              }}
              type="button"
            >
              Open case
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="grid min-h-32 content-between gap-3 p-4">
              <metric.icon className={`h-5 w-5 ${metric.iconClassName}`} aria-hidden="true" />
              <div>
                <p className="text-2xl font-semibold">{metric.value}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{metric.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center">
            <CardTitle>Next actions</CardTitle>
            <Button
              onClick={() => {
                void onOpenCase(primaryCase.id, "case-overview");
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              View all
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {actions.map((action) => {
              const ActionIcon = actionIcons[action.destinationId];

              return (
                <button
                  key={action.destinationId}
                  className="group grid min-h-20 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-secondary/30 p-3 text-left hover:bg-secondary/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    void onOpenCase(primaryCase.id, action.destinationId);
                  }}
                  type="button"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                    <ActionIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{action.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {action.detail}
                    </span>
                  </span>
                  <ArrowRight
                    className="h-4 w-4 text-muted-foreground group-hover:text-foreground"
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress overview</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border rounded-md border border-border">
              <OverviewRow label="Case type" value={primaryCase.caseType.name} />
              <OverviewRow label="Platform" value={primaryCase.platform} />
              <OverviewRow
                label="Deadline"
                value={primaryCase.deadline ? formatCaseDate(primaryCase.deadline) : "Not set"}
              />
              <OverviewRow label="Status" value={formatCaseStatus(primaryCase.status)} />
            </dl>
            <p className="mt-3 rounded-md border border-primary/25 bg-primary/10 px-3 py-3 text-sm leading-6 text-muted-foreground">
              {getCaseProgressMessage(readiness)}
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 xl:col-span-1">
        <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center">
          <CardTitle>Recent activity</CardTitle>
          <Button
            onClick={() => {
              void onOpenCase(primaryCase.id, "case-timeline");
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            View timeline
          </Button>
        </CardHeader>
        <CardContent>
          {recentEvents.length ? (
            <ol className="divide-y divide-border">
              {recentEvents.map((event) => (
                <li
                  key={event.id}
                  className="grid grid-cols-[4.5rem_auto_minmax(0,1fr)] items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <time className="pt-1 text-xs text-muted-foreground" dateTime={event.occurredAt}>
                    {formatCaseDate(event.occurredAt, false)}
                  </time>
                  <span className="mt-1.5 h-2.5 w-2.5 rounded-full border border-primary bg-primary/30" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{event.title}</span>
                    {event.description ? (
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {event.description}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-md border border-dashed border-border bg-secondary/25 px-3 py-4 text-sm text-muted-foreground">
              Timeline activity will appear here after events are added or extracted.
            </p>
          )}
        </CardContent>
        </Card>
      </div>

      {primaryCase.checklist?.length ? (
        <Card>
          <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center">
            <CardTitle>Case checklist overview</CardTitle>
            <Button
              onClick={() => {
                void onOpenCase(primaryCase.id, "evidence-checklist");
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              {getCompletedChecklistCount(primaryCase)} of {primaryCase.checklist.length} ready
            </Button>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
              {primaryCase.checklist.map((item) => {
                const isReady = isChecklistReady(item.status);
                const StatusIcon = isReady ? CheckCircle2 : Circle;

                return (
                  <li
                    className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 border-t border-border pt-3"
                    key={item.id}
                  >
                    <StatusIcon
                      aria-hidden="true"
                      className={isReady ? "h-4 w-4 text-teal-300" : "h-4 w-4 text-primary"}
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold leading-5 text-foreground">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {isReady ? "Evidence matched" : "Needs attention"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,0.6fr)_minmax(0,1fr)] gap-3 px-3 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function getCaseMetrics(caseRecord: CaseRecord) {
  return [
    {
      icon: FileText,
      iconClassName: "text-sky-300",
      label: "Evidence files",
      value: String(caseRecord._count?.documents ?? 0)
    },
    {
      icon: CheckCircle2,
      iconClassName: "text-teal-300",
      label: "Checklist ready",
      value: String(getCompletedChecklistCount(caseRecord))
    },
    {
      icon: TriangleAlert,
      iconClassName: "text-amber-200",
      label: "Missing items",
      value: String(getMissingChecklistCount(caseRecord))
    },
    {
      icon: Clock3,
      iconClassName: "text-violet-300",
      label: "Timeline events",
      value: String(caseRecord.events?.length ?? caseRecord._count?.events ?? 0)
    }
  ];
}
