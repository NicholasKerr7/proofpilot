import { AlertTriangle, BriefcaseBusiness, CalendarDays, CheckCircle2 } from "lucide-react";
import {
  formatCaseDate,
  formatCaseReference,
  formatCaseStatus,
  getCaseStatusVariant
} from "@/components/app/cases/case-utils";
import type { CaseRecord } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface EvidenceImportHeroProps {
  caseRecord: CaseRecord;
}

export function EvidenceImportHero({ caseRecord }: EvidenceImportHeroProps) {
  const statusVariant = getCaseStatusVariant(caseRecord.status);
  const StatusIcon = statusVariant === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <section
      aria-label={`Primary case: ${caseRecord.title}`}
      className="proof-accent-frame grid gap-4 rounded-md border p-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(9rem,0.7fr)_minmax(11rem,0.9fr)] sm:items-center sm:p-5"
    >
      <div className="grid min-w-0 grid-cols-[3.75rem_minmax(0,1fr)] items-center gap-4 sm:block">
        <span className="flex h-15 w-15 items-center justify-center rounded-full border border-primary/55 bg-primary/10 text-primary sm:hidden">
          <BriefcaseBusiness className="h-7 w-7" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-primary">
            <BriefcaseBusiness className="hidden h-4 w-4 sm:block" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase">Primary case</p>
          </div>
          <h2 className="mt-2 break-words text-lg font-semibold leading-6 sm:text-xl sm:leading-7">
            {caseRecord.title}
          </h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {formatCaseReference(caseRecord)}
          </p>
        </div>
      </div>

      <dl className="contents">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-t border-border pt-4 sm:min-h-20 sm:content-center sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <CalendarDays className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <dt className="text-xs text-muted-foreground">Deadline</dt>
            <dd className="mt-1 text-sm font-medium">
              {caseRecord.deadline ? formatCaseDate(caseRecord.deadline) : "Not set"}
            </dd>
          </div>
        </div>

        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-t border-border pt-4 sm:min-h-20 sm:content-center sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <StatusIcon
            className={cn(
              "mt-0.5 h-5 w-5",
              statusVariant === "success" ? "text-teal-300" : "text-primary"
            )}
            aria-hidden="true"
          />
          <div>
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd
              className={cn(
                "mt-1 text-sm font-medium",
                statusVariant === "success" ? "text-teal-200" : "text-primary"
              )}
            >
              {formatCaseStatus(caseRecord.status)}
            </dd>
          </div>
        </div>
      </dl>
    </section>
  );
}
