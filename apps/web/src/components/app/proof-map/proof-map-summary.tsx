import type { ProofMapResponse } from "@proofpilot/types";
import { CircleDashed, ScanSearch, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface ProofMapSummaryProps {
  summary: ProofMapResponse["summary"];
}

export function ProofMapSummary({ summary }: ProofMapSummaryProps) {
  const attentionCount = summary.weak + summary.needsReview;
  const metrics = [
    {
      icon: ShieldCheck,
      label: "Supported",
      value: summary.supported,
      tone: "text-teal-200"
    },
    {
      icon: TriangleAlert,
      label: "Weak",
      value: summary.weak,
      tone: "text-amber-200"
    },
    {
      icon: ScanSearch,
      label: "Review",
      value: summary.needsReview,
      tone: "text-primary"
    },
    {
      icon: CircleDashed,
      label: "Missing",
      value: summary.missing,
      tone: "text-red-200"
    }
  ];

  return (
    <Card className="proof-accent-frame">
      <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] md:items-center md:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-primary">
                Argument coverage
              </p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {summary.coverage}%
              </p>
            </div>
            <Badge
              variant={
                summary.missing || attentionCount ? "warning" : "success"
              }
            >
              {summary.missing
                ? `${summary.missing} ${summary.missing === 1 ? "gap" : "gaps"}`
                : attentionCount
                  ? `${attentionCount} need strengthening`
                  : "All claims supported"}
            </Badge>
          </div>
          <progress
            aria-label={`${summary.coverage}% argument coverage`}
            className="proof-progress mt-4"
            max={100}
            value={summary.coverage}
          />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Coverage reflects source diversity, evidence review state, and the
            strength of each required appeal claim.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
          {metrics.map((metric) => (
            <div
              className="grid min-h-24 content-center gap-2 bg-card px-4 py-3"
              key={metric.label}
            >
              <dt className={`flex items-center gap-2 text-xs font-semibold uppercase ${metric.tone}`}>
                <metric.icon className="h-4 w-4" aria-hidden="true" />
                {metric.label}
              </dt>
              <dd className="font-mono text-2xl font-semibold text-foreground">
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
