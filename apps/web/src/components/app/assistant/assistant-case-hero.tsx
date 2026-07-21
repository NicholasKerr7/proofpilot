import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  CircleAlert
} from "lucide-react";
import type { AssistantCaseSummary } from "@proofpilot/types";
import { CaseProgressRing } from "@/components/app/cases/case-progress-ring";
import {
  formatCaseDate,
  formatCaseReference,
  formatCaseStatus,
  getCaseProgressMessage,
  getCaseStatusVariant
} from "@/components/app/cases/case-utils";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import type { CaseRecord } from "@/lib/client/types";

interface AssistantCaseHeroProps {
  cases: CaseRecord[];
  isSelectingCase: boolean;
  onOpenCurrentCase: () => void;
  onSelectCase: (caseId: string) => void;
  selectedCase: CaseRecord;
  summary: AssistantCaseSummary;
}

export function AssistantCaseHero({
  cases,
  isSelectingCase,
  onOpenCurrentCase,
  onSelectCase,
  selectedCase,
  summary
}: AssistantCaseHeroProps) {
  return (
    <section
      aria-label="Current assistant case"
      className="proof-accent-frame rounded-lg border px-4 py-5 sm:px-6 md:px-7 md:py-6"
    >
      <div className="md:hidden">
        <p className="text-xs font-semibold uppercase text-primary">Current case</p>
        <button
          className="mt-3 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onOpenCurrentCase}
          type="button"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary">
            <BriefcaseBusiness className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="break-words text-base font-semibold leading-6">{summary.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCaseReference(selectedCase)}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </button>
        {cases.length > 1 ? (
          <Select
            aria-label="Assistant case"
            className="mt-4"
            disabled={isSelectingCase}
            onChange={(event) => onSelectCase(event.target.value)}
            value={selectedCase.id}
          >
            {cases.map((caseRecord) => (
              <option key={caseRecord.id} value={caseRecord.id}>
                {caseRecord.title}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      <div className="hidden md:grid md:grid-cols-[minmax(0,1.35fr)_auto_minmax(180px,0.8fr)] md:items-center md:gap-7">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
              <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
              Primary case
            </p>
            {cases.length > 1 ? (
              <Select
                aria-label="Assistant case"
                className="w-auto min-w-44"
                disabled={isSelectingCase}
                onChange={(event) => onSelectCase(event.target.value)}
                value={selectedCase.id}
              >
                {cases.map((caseRecord) => (
                  <option key={caseRecord.id} value={caseRecord.id}>
                    {caseRecord.title}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>

          <h2 className="mt-3 break-words text-3xl font-semibold leading-tight text-foreground">
            {summary.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatCaseReference(selectedCase)}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
            <div className="flex min-w-0 items-center gap-3">
              <CalendarDays className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Deadline</p>
                <p className="mt-1 truncate text-sm font-medium">
                  {summary.deadline ? formatCaseDate(summary.deadline) : "Not set"}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-3 border-l border-border pl-4">
              <CircleAlert className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge
                  className="mt-1 max-w-full whitespace-normal leading-4"
                  variant={getCaseStatusVariant(summary.status)}
                >
                  {formatCaseStatus(summary.status)}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <CaseProgressRing value={summary.progress} />

        <div className="border-l border-border pl-7">
          <p className="font-semibold text-foreground">Your case is taking shape.</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {getCaseProgressMessage(summary.progress)}
          </p>
        </div>
      </div>
    </section>
  );
}
