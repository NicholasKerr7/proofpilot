import { BriefcaseBusiness, CalendarDays, FileSpreadsheet } from "lucide-react";
import { CaseProgressRing } from "@/components/app/cases/case-progress-ring";
import {
  formatCaseDate,
  formatCaseReference,
  formatCaseStatus,
  getCaseCompletenessScore,
  getCaseStatusVariant
} from "@/components/app/cases/case-utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CaseRecord } from "@/lib/client/types";

interface ReportExportScopeProps {
  scopeLabel: string;
  selectedCase: CaseRecord | null;
}

export function ReportExportScope({ scopeLabel, selectedCase }: ReportExportScopeProps) {
  if (!selectedCase) {
    return (
      <Card className="border-primary/45">
        <CardContent className="grid gap-3 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center md:p-6">
          <span className="flex h-14 w-14 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <FileSpreadsheet className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase text-primary">Report scope</p>
            <h2 className="mt-1 break-words text-xl font-semibold text-foreground">
              {scopeLabel}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Active cases with recorded activity in the selected dates.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const completeness = getCaseCompletenessScore(selectedCase);

  return (
    <Card className="border-primary/45">
      <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase text-primary">
            <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />
            <span>Primary case</span>
          </div>
          <h2 className="mt-3 break-words text-xl font-semibold text-foreground md:text-2xl">
            {selectedCase.title}
          </h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {formatCaseReference(selectedCase)}
          </p>

          <div className="mt-4 hidden gap-3 border-t border-border pt-4 sm:grid-cols-2 md:grid">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
              <div>
                <p className="text-xs text-muted-foreground">Deadline</p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {selectedCase.deadline ? formatCaseDate(selectedCase.deadline) : "Not set"}
                </p>
              </div>
            </div>
            <div className="sm:border-l sm:border-border sm:pl-4">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge className="mt-1" variant={getCaseStatusVariant(selectedCase.status)}>
                {formatCaseStatus(selectedCase.status)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-3 border-t border-border pt-4 md:flex md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <CaseProgressRing label="Case completeness" size="compact" value={completeness} />
          <div>
            <p className="text-xs text-muted-foreground">Progress</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{completeness}% complete</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
