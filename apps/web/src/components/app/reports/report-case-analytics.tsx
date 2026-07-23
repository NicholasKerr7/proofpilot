import {
  Activity,
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileArchive,
  FileText,
  ListChecks,
  TriangleAlert,
  UploadCloud
} from "lucide-react";
import type { ReportCaseSummary, ReportSummary } from "@proofpilot/types";
import { CaseProgressRing } from "@/components/app/cases/case-progress-ring";
import {
  ActivityRow,
  CaseEvidenceRow,
  CaseMetric,
  StatusRow
} from "@/components/app/reports/report-case-analytics-rows";
import {
  formatDeadline,
  getCaseInsights,
  getCaseSummary
} from "@/components/app/reports/report-case-insights";
import {
  formatReportBytes,
  formatReportDateTime,
  formatReportStatus
} from "@/components/app/reports/report-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReportCaseAnalyticsProps {
  caseRecord: ReportCaseSummary;
  onExport: (caseId: string) => void;
  onOpenCase: (caseId: string) => void;
  summary: ReportSummary;
}

export function ReportCaseAnalytics({
  caseRecord,
  onExport,
  onOpenCase,
  summary
}: ReportCaseAnalyticsProps) {
  const openChecklistItems = Math.max(
    caseRecord.checklistCount - caseRecord.completedChecklistCount,
    0
  );
  const insights = getCaseInsights(caseRecord);

  return (
    <div className="hidden gap-5 md:grid">
      <Card className="proof-accent-frame">
        <CardContent className="grid gap-5 p-6 md:grid-cols-[minmax(0,1.15fr)_auto_minmax(9rem,0.65fr)] md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase text-primary">
              <Briefcase aria-hidden="true" className="h-5 w-5" />
              <span>Reports / analytics</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <h2 className="break-words text-2xl font-semibold text-foreground">
                {caseRecord.title}
              </h2>
              <Badge variant="secondary">{caseRecord.platform}</Badge>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2">
                <CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Deadline</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {formatDeadline(caseRecord.deadline)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 border-l border-border pl-4">
                <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="mt-1 font-semibold text-primary">
                    {formatReportStatus(caseRecord.status)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <CaseProgressRing label="Completeness" value={caseRecord.completeness} />

          <p className="border-l border-border pl-5 text-sm leading-7 text-muted-foreground">
            {getCaseSummary(caseRecord, openChecklistItems)}
          </p>
        </CardContent>
      </Card>

      <section aria-labelledby="case-completion-overview" className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2
            className="text-sm font-semibold uppercase text-primary"
            id="case-completion-overview"
          >
            Completion overview
          </h2>
          <span className="text-xs text-muted-foreground">
            Updated {formatReportDateTime(caseRecord.updatedAt)}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <CaseMetric
            icon={CheckCircle2}
            label="Overall progress"
            value={`${caseRecord.completeness}%`}
          />
          <CaseMetric
            icon={ListChecks}
            label="Checklist complete"
            value={`${caseRecord.completedChecklistCount} / ${caseRecord.checklistCount}`}
          />
          <CaseMetric
            icon={FileText}
            label="Evidence files"
            value={String(caseRecord.documentCount)}
          />
          <CaseMetric
            icon={FileArchive}
            label="Packets generated"
            value={String(caseRecord.packetCount)}
          />
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center">
            <CardTitle className="text-sm uppercase text-primary">
              Evidence category progress
            </CardTitle>
            <Badge variant="secondary">
              {caseRecord.documentCount} {caseRecord.documentCount === 1 ? "item" : "items"}
            </Badge>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {summary.evidenceBreakdown.map((item) => (
              <CaseEvidenceRow item={item} key={item.category} total={caseRecord.documentCount} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center">
            <CardTitle className="text-sm uppercase text-primary">Case activity</CardTitle>
            <Activity aria-hidden="true" className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            <ActivityRow icon={Activity} label="Timeline events" value={caseRecord.eventCount} />
            <ActivityRow
              icon={FileText}
              label="Statement versions"
              value={caseRecord.statementCount}
            />
            <ActivityRow
              icon={FileArchive}
              label="Packets generated"
              value={caseRecord.packetCount}
            />
            <ActivityRow
              icon={UploadCloud}
              label="Evidence storage"
              value={formatReportBytes(caseRecord.evidenceByteSize)}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase text-primary">Status summary</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            <StatusRow
              icon={caseRecord.completeness >= 80 ? CheckCircle2 : Clock3}
              label="Case status"
              value={formatReportStatus(caseRecord.status)}
            />
            <StatusRow
              icon={CheckCircle2}
              label="Checklist complete"
              value={caseRecord.completedChecklistCount}
            />
            <StatusRow
              icon={openChecklistItems ? TriangleAlert : CheckCircle2}
              label="Checklist remaining"
              value={openChecklistItems}
            />
            <StatusRow
              icon={FileArchive}
              label="Packets available"
              value={caseRecord.packetCount}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase text-primary">
              Insights &amp; recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {insights.map((insight) => (
              <div
                className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 p-4"
                key={insight.title}
              >
                <insight.icon
                  aria-hidden="true"
                  className={`mt-0.5 h-5 w-5 ${insight.iconClassName}`}
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{insight.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
          <div className="grid grid-cols-2 gap-3 border-t border-border p-4">
            <Button onClick={() => onOpenCase(caseRecord.id)} type="button" variant="outline">
              Open case
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Button>
            <Button onClick={() => onExport(caseRecord.id)} type="button">
              <FileArchive aria-hidden="true" className="h-4 w-4" />
              Export report
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
