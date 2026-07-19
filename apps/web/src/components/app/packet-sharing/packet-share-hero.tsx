import { BriefcaseBusiness, CalendarDays, CheckCircle2 } from "lucide-react";
import { CaseProgressRing } from "@/components/app/cases/case-progress-ring";
import {
  formatCaseDate,
  formatCaseReference,
  formatCaseStatus,
  getCaseReadiness
} from "@/components/app/cases/case-utils";
import { Badge } from "@/components/ui/badge";
import type { CaseRecord } from "@/lib/client/types";

interface PacketShareHeroProps {
  caseRecord: CaseRecord;
  showReadiness?: boolean;
}

export function PacketShareHero({ caseRecord, showReadiness = true }: PacketShareHeroProps) {
  const readiness = getCaseReadiness(caseRecord);

  return (
    <section className="grid gap-5 rounded-md border border-primary/35 bg-card p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <BriefcaseBusiness className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase text-primary">Primary case</span>
          <Badge variant={readiness >= 80 ? "success" : "warning"}>{readiness}% ready</Badge>
        </div>
        <h2 className="mt-3 break-words text-xl font-semibold leading-7 md:text-2xl md:leading-8">
          {caseRecord.title}
        </h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {formatCaseReference(caseRecord)}
        </p>
        <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
            <CalendarDays className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
            <div>
              <dt className="text-xs text-muted-foreground">Deadline</dt>
              <dd className="mt-1 text-sm font-medium">
                {caseRecord.deadline ? formatCaseDate(caseRecord.deadline) : "Not set"}
              </dd>
            </div>
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:border-l sm:border-border sm:pl-4">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="mt-1 text-sm font-medium">{formatCaseStatus(caseRecord.status)}</dd>
            </div>
          </div>
        </dl>
      </div>

      {showReadiness ? (
        <CaseProgressRing className="hidden md:flex" value={readiness} />
      ) : null}
    </section>
  );
}
