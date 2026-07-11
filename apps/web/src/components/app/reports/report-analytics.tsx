"use client";

import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileArchive,
  FileText,
  FolderOpen,
  ImageIcon,
  ListChecks,
  Mail,
  TableProperties,
  TriangleAlert,
  UploadCloud,
  type LucideIcon
} from "lucide-react";
import type {
  ReportEvidenceCategory,
  ReportEvidenceBreakdownItem,
  ReportSummary
} from "@proofpilot/types";
import { CaseProgressRing } from "@/components/app/cases/case-progress-ring";
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

const evidenceIcons: Record<ReportEvidenceCategory, LucideIcon> = {
  images: ImageIcon,
  documents: FileText,
  emails: Mail,
  data: TableProperties,
  other: UploadCloud
};

interface ReportAnalyticsProps {
  onExport: () => void;
  onOpenCase: (caseId: string) => void;
  summary: ReportSummary;
}

export function ReportAnalytics({ onExport, onOpenCase, summary }: ReportAnalyticsProps) {
  const checklistCompletion = getChecklistCompletion(summary);
  const insights = getReportInsights(summary);

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ReportMetric
          icon={FolderOpen}
          label="Cases"
          value={String(summary.metrics.totalCases)}
        />
        <ReportMetric
          icon={CheckCircle2}
          label="Average readiness"
          value={`${summary.metrics.averageReadiness}%`}
        />
        <ReportMetric
          icon={FileText}
          label="Evidence files"
          value={String(summary.metrics.totalDocuments)}
        />
        <ReportMetric
          icon={FileArchive}
          label="Packets"
          value={String(summary.metrics.totalPackets)}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Completion overview</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <CaseProgressRing label="Readiness" value={summary.metrics.averageReadiness} />
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

      <div className="grid gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
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

      <Card>
        <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center">
          <CardTitle>Case performance</CardTitle>
          <Button onClick={onExport} size="sm" type="button" variant="outline">
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
                      <span>{caseRecord.readiness}% ready</span>
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

function ReportMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="grid min-h-32 content-between gap-3 p-4">
        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenceCoverage({ item, total }: { item: ReportEvidenceBreakdownItem; total: number }) {
  const Icon = evidenceIcons[item.category];
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

  const openChecklistItems =
    summary.metrics.totalChecklistItems - summary.metrics.completedChecklistItems;
  const noEvidenceCases = summary.cases.filter((caseRecord) => !caseRecord.documentCount).length;

  return [
    {
      title:
        summary.metrics.averageReadiness >= 80
          ? "Cases are approaching review readiness"
          : "Case packets are still being assembled",
      detail: `Average readiness is ${summary.metrics.averageReadiness}% across ${summary.metrics.totalCases} ${
        summary.metrics.totalCases === 1 ? "case" : "cases"
      }.`,
      icon: summary.metrics.averageReadiness >= 80 ? CheckCircle2 : Clock3,
      iconClassName: summary.metrics.averageReadiness >= 80 ? "text-teal-300" : "text-primary"
    },
    {
      title: openChecklistItems
        ? `${openChecklistItems} checklist ${openChecklistItems === 1 ? "item" : "items"} remain open`
        : "Checklist coverage is complete",
      detail: `${summary.metrics.completedChecklistItems} of ${summary.metrics.totalChecklistItems} requirements are complete or found.`,
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
  ];
}
