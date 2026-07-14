import type { LucideIcon } from "lucide-react";
import type { ReportEvidenceBreakdownItem } from "@proofpilot/types";
import { reportEvidenceIcons } from "@/components/app/reports/report-evidence-icons";
import { evidenceCategoryLabels, formatReportBytes } from "@/components/app/reports/report-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function CaseMetric({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="grid min-h-28 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CaseEvidenceRow({
  item,
  total
}: {
  item: ReportEvidenceBreakdownItem;
  total: number;
}) {
  const Icon = reportEvidenceIcons[item.category];
  const percent = total ? Math.round((item.count / total) * 100) : 0;

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium text-foreground">
            {evidenceCategoryLabels[item.category]}
          </span>
          <span className="shrink-0 text-muted-foreground">
            {item.count} · {formatReportBytes(item.byteSize)}
          </span>
        </div>
        <Progress
          ariaLabel={`${evidenceCategoryLabels[item.category]} evidence coverage`}
          className="mt-2"
          value={percent}
        />
      </div>
    </div>
  );
}

export function ActivityRow({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <div className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
      <Icon aria-hidden="true" className="h-4 w-4 text-primary" />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function StatusRow({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <div className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
      <Icon aria-hidden="true" className="h-5 w-5 text-primary" />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-32 text-right text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}
