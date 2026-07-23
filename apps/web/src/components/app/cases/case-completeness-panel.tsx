import { ArrowRight, CheckCircle2, CircleDashed, TriangleAlert } from "lucide-react";
import type {
  CaseCompleteness,
  CaseCompletenessStatus,
  CaseDestinationId
} from "@/components/app/cases/case-utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CaseCompletenessPanelProps {
  completeness: CaseCompleteness;
  onOpenCriterion: (destinationId: CaseDestinationId) => void;
}

export function CaseCompletenessPanel({
  completeness,
  onOpenCriterion
}: CaseCompletenessPanelProps) {
  const completedCount = completeness.criteria.filter(
    (criterion) => criterion.status === "complete"
  ).length;

  return (
    <Card>
      <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div>
          <CardTitle>Case completeness</CardTitle>
          <CardDescription>
            Weighted checks for the evidence, timeline, requirements, and saved statement.
          </CardDescription>
        </div>
        <div className="grid justify-items-end gap-1">
          <Badge variant={completeness.score >= 80 ? "success" : "warning"}>
            {completeness.score}% complete
          </Badge>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{completeness.criteria.length} checks
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ol className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {completeness.criteria.map((criterion) => {
            const StatusIcon = getCompletenessStatusIcon(criterion.status);

            return (
              <li key={criterion.id}>
                <button
                  className="group grid min-h-20 w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 bg-secondary/20 px-3 py-3 text-left transition-colors hover:bg-secondary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4"
                  onClick={() => onOpenCriterion(criterion.destinationId)}
                  type="button"
                >
                  <span className={getCompletenessIconClassName(criterion.status)}>
                    <StatusIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      {criterion.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {criterion.detail}
                    </span>
                  </span>
                  <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {criterion.earned}/{criterion.weight}
                  </span>
                  <ArrowRight
                    className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ol>

        {completeness.capReasons.length ? (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-3 text-sm">
            <TriangleAlert className="mt-0.5 h-4 w-4 text-amber-200" aria-hidden="true" />
            <div>
              <p className="font-semibold text-amber-100">Score limit active</p>
              <p className="mt-1 leading-6 text-muted-foreground">
                {completeness.capReasons[0]}
              </p>
            </div>
          </div>
        ) : null}

        <p className="text-xs leading-5 text-muted-foreground">
          Completeness measures whether the case record is assembled. It does not predict an
          appeal decision.
        </p>
      </CardContent>
    </Card>
  );
}

function getCompletenessStatusIcon(status: CaseCompletenessStatus) {
  return status === "complete"
    ? CheckCircle2
    : status === "partial"
      ? CircleDashed
      : TriangleAlert;
}

function getCompletenessIconClassName(status: CaseCompletenessStatus) {
  if (status === "complete") {
    return "flex h-10 w-10 items-center justify-center rounded-md border border-teal-400/25 bg-teal-400/10 text-teal-200";
  }

  if (status === "partial") {
    return "flex h-10 w-10 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary";
  }

  return "flex h-10 w-10 items-center justify-center rounded-md border border-amber-300/25 bg-amber-300/10 text-amber-200";
}
