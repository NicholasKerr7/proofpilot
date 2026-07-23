"use client";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileArchive,
  FileText,
  FileWarning,
  FolderOpen,
  ListChecks,
  TriangleAlert,
  UploadCloud,
  type LucideIcon
} from "lucide-react";
import type {
  ReportEvidenceBreakdownItem,
  ReportSummary
} from "@proofpilot/types";
import { CaseProgressRing } from "@/components/app/cases/case-progress-ring";
import { ReportCaseAnalytics } from "@/components/app/reports/report-case-analytics";
import { reportEvidenceIcons } from "@/components/app/reports/report-evidence-icons";
import {
  evidenceCategoryLabels,
  formatReportBytes,
  formatReportDateTime,
  formatReportStatus,
  getChecklistCompletion
} from "@/components/app/reports/report-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ReportAnalyticsProps {
  onExport: (caseId?: string) => void;
  onOpenCase: (caseId: string) => void;
  summary: ReportSummary;
}

export function ReportAnalytics({ onExport, onOpenCase, summary }: ReportAnalyticsProps) {
  const checklistCompletion = getChecklistCompletion(summary);
  const insights = getReportInsights(summary);
  const focusedCase = summary.cases.length === 1 ? summary.cases[0] : null;

  return (
    <div
      className={
        focusedCase
          ? "grid gap-5 md:[&>.aggregate-report-section]:hidden"
          : "grid gap-5"
      }
    >
      {focusedCase ? (
        <ReportCaseAnalytics
          caseRecord={focusedCase}
          onExport={onExport}
          onOpenCase={onOpenCase}
          summary={summary}
        />
      ) : null}

      <div className="aggregate-report-section grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <ReportMetric
          icon={FolderOpen}
          iconClassName="text-primary"
          label="Open cases"
          value={String(summary.metrics.activeCases)}
        />
        <ReportMetric
          icon={FileText}
          iconClassName="text-sky-300"
          label="Evidence uploaded"
          value={String(summary.metrics.totalDocuments)}
        />
        <ReportMetric
          icon={TriangleAlert}
          iconClassName="text-amber-200"
          label="Missing evidence"
          value={String(summary.metrics.missingChecklistItems)}
        />
        <ReportMetric
          icon={CalendarDays}
          iconClassName="text-violet-300"
          label="Upcoming deadlines"
          value={String(summary.metrics.upcomingDeadlines)}
        />
        <ReportMetric
          icon={FileArchive}
          iconClassName="text-teal-300"
          label="Packets generated"
          value={String(summary.metrics.totalPackets)}
        />
        <ReportMetric
          icon={FileWarning}
          iconClassName={summary.metrics.failedDocuments ? "text-red-300" : "text-muted-foreground"}
          label="Failed processing"
          value={String(summary.metrics.failedDocuments)}
        />
      </div>

      <div className="aggregate-report-section grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Completion overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <CaseProgressRing label="Completeness" value={summary.metrics.averageCompleteness} />
            <div className="grid gap-4">
              <Progress label="Checklist coverage" value={checklistCompletion} />
              <Progress
                label="Cases with evidence"
                value={getCasesWithEvidencePercent(summary)}
              />
              <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Active cases</dt>
                  <dd className="mt-1 font-semibold">{summary.metrics.activeCases}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Timeline events</dt>
                  <dd className="mt-1 font-semibold">{summary.metrics.totalEvents}</dd>
                </div>
              </dl>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center">
            <CardTitle>Evidence coverage</CardTitle>
            <Badge variant="secondary">{formatReportBytes(summary.metrics.totalEvidenceBytes)}</Badge>
          </CardHeader>
          <CardContent className="grid gap-4">
            {summary.evidenceBreakdown.map((item) => (
              <EvidenceCoverage
                item={item}
                key={item.category}
                total={summary.metrics.totalDocuments}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="aggregate-report-section grid gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Status summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {summary.statusBreakdown.length ? (
              summary.statusBreakdown.map((item) => (
                <Progress
                  key={item.status}
                  label={`${formatReportStatus(item.status)} (${item.count})`}
                  value={
                    summary.metrics.totalCases
                      ? Math.round((item.count / summary.metrics.totalCases) * 100)
                      : 0
                  }
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No case statuses to summarize.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current insights</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {insights.map((insight) => (
              <div
                className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-md border border-border bg-secondary/25 p-3"
                key={insight.title}
              >
                <insight.icon className={`mt-0.5 h-5 w-5 ${insight.iconClassName}`} aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{insight.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="aggregate-report-section">
        <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center">
          <CardTitle>Case performance</CardTitle>
          <Button onClick={() => onExport()} size="sm" type="button" variant="outline">
            <FileArchive className="h-4 w-4" aria-hidden="true" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          {summary.cases.length ? (
            <div className="divide-y divide-border rounded-md border border-border">
              {summary.cases.map((caseRecord) => (
                <div
                  className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4"
                  key={caseRecord.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words text-sm font-semibold text-foreground">
                        {caseRecord.title}
                      </p>
                      <Badge variant="secondary">{caseRecord.platform}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{caseRecord.completeness}% complete</span>
                      <span>{caseRecord.documentCount} evidence files</span>
                      <span>Updated {formatReportDateTime(caseRecord.updatedAt)}</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => onOpenCase(caseRecord.id)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Open
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid min-h-40 place-items-center rounded-md border border-dashed border-border bg-secondary/20 p-5 text-center">
              <div>
                <FolderOpen className="mx-auto h-6 w-6 text-primary" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold">No cases in this report</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReportMetric({
  icon: Icon,
  iconClassName,
  label,
  value
}: {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="grid min-h-32 content-between gap-3 p-4">
        <Icon className={`h-5 w-5 ${iconClassName}`} aria-hidden="true" />
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenceCoverage({ item, total }: { item: ReportEvidenceBreakdownItem; total: number }) {
  const Icon = reportEvidenceIcons[item.category];
  const percent = total ? Math.round((item.count / total) * 100) : 0;

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-foreground">{evidenceCategoryLabels[item.category]}</span>
          <span className="text-muted-foreground">
            {item.count} · {formatReportBytes(item.byteSize)}
          </span>
        </div>
        <Progress
          ariaLabel={`${evidenceCategoryLabels[item.category]} coverage`}
          className="mt-2"
          value={percent}
        />
      </div>
    </div>
  );
}

function getCasesWithEvidencePercent(summary: ReportSummary) {
  if (!summary.metrics.totalCases) {
    return 0;
  }

  const casesWithEvidence = summary.cases.filter((caseRecord) => caseRecord.documentCount > 0).length;
  return Math.round((casesWithEvidence / summary.metrics.totalCases) * 100);
}

function getReportInsights(summary: ReportSummary) {
  if (!summary.metrics.totalCases) {
    return [
      {
        title: "No cases in this report",
        detail: "Create a case or change the report scope to review current analytics.",
        icon: FolderOpen,
        iconClassName: "text-primary"
      }
    ];
  }

  const openChecklistItems = summary.metrics.missingChecklistItems;
  const noEvidenceCases = summary.cases.filter((caseRecord) => !caseRecord.documentCount).length;
  const operationalInsights: Array<{
    detail: string;
    icon: LucideIcon;
    iconClassName: string;
    title: string;
  }> = [];

  if (summary.metrics.failedDocuments) {
    operationalInsights.push({
      title: `${summary.metrics.failedDocuments} failed evidence ${
        summary.metrics.failedDocuments === 1 ? "file needs" : "files need"
      } review`,
      detail: "Review processing details and retry supported files before packet generation.",
      icon: FileWarning,
      iconClassName: "text-red-300"
    });
  }

  if (summary.metrics.upcomingDeadlines) {
    operationalInsights.push({
      title: `${summary.metrics.upcomingDeadlines} upcoming ${
        summary.metrics.upcomingDeadlines === 1 ? "deadline" : "deadlines"
      }`,
      detail: "Prioritize evidence and final review for active cases with scheduled deadlines.",
      icon: CalendarDays,
      iconClassName: "text-violet-300"
    });
  }

  return [
    ...operationalInsights,
    {
      title:
        summary.metrics.averageCompleteness >= 80
          ? "Case records are nearly complete"
          : "Case packets are still being assembled",
      detail: `Average completeness is ${summary.metrics.averageCompleteness}% across ${summary.metrics.totalCases} ${
        summary.metrics.totalCases === 1 ? "case" : "cases"
      }.`,
      icon: summary.metrics.averageCompleteness >= 80 ? CheckCircle2 : Clock3,
      iconClassName: summary.metrics.averageCompleteness >= 80 ? "text-teal-300" : "text-primary"
    },
    {
      title: openChecklistItems
        ? `${openChecklistItems} checklist ${openChecklistItems === 1 ? "item" : "items"} remain open`
        : "Checklist coverage is complete",
      detail: openChecklistItems
        ? "Review missing or uncertain requirements before generating the next packet."
        : "Every required checklist item is complete or matched to evidence.",
      icon: openChecklistItems ? TriangleAlert : ListChecks,
      iconClassName: openChecklistItems ? "text-amber-300" : "text-teal-300"
    },
    {
      title: noEvidenceCases
        ? `${noEvidenceCases} ${noEvidenceCases === 1 ? "case has" : "cases have"} no evidence files`
        : "Every case has evidence files",
      detail: `${summary.metrics.totalDocuments} evidence files are currently stored in this report scope.`,
      icon: UploadCloud,
      iconClassName: noEvidenceCases ? "text-amber-300" : "text-teal-300"
    }
  ].slice(0, 4);
}
