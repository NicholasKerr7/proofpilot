import type { ProofMapClaim, ProofMapSource } from "@proofpilot/types";
import {
  ArrowUpRight,
  CalendarClock,
  FileSearch,
  PenLine,
  ShieldCheck
} from "lucide-react";
import type { CaseDestinationId } from "@/components/app/cases/case-utils";
import {
  formatProofClaimStatus,
  getProofClaimVariant
} from "@/components/app/proof-map/proof-map-utils";
import { Badge } from "@/components/ui/badge";

interface ProofMapSourceInspectorProps {
  claim: ProofMapClaim;
  onOpenDestination: (destinationId: CaseDestinationId) => void;
}

export function ProofMapSourceInspector({
  claim,
  onOpenDestination
}: ProofMapSourceInspectorProps) {
  return (
    <section aria-labelledby="proof-inspector-heading" className="min-w-0">
      <div className="border-b border-border px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-primary">
              Claim analysis
            </p>
            <h2
              className="mt-2 text-xl font-semibold leading-7"
              id="proof-inspector-heading"
            >
              {claim.label}
            </h2>
          </div>
          <Badge variant={getProofClaimVariant(claim.status)}>
            {formatProofClaimStatus(claim.status)}
          </Badge>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {claim.description}
        </p>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <progress
            aria-label={`${claim.strength}% claim strength`}
            className="proof-progress"
            max={100}
            value={claim.strength}
          />
          <span className="font-mono text-sm font-semibold text-foreground">
            {claim.strength}%
          </span>
        </div>
      </div>

      {claim.gaps.length ? (
        <div className="border-b border-border bg-amber-300/[0.06] px-4 py-4 sm:px-6">
          <p className="text-xs font-semibold uppercase text-amber-100">
            Evidence gaps
          </p>
          <ul className="mt-2 grid gap-2">
            {claim.gaps.map((gap) => (
              <li
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 text-sm leading-6 text-muted-foreground"
                key={gap}
              >
                <span
                  className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-300"
                  aria-hidden="true"
                />
                {gap}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-b border-border bg-teal-400/[0.06] px-4 py-4 text-sm text-teal-100 sm:px-6">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          This claim is supported by independent case records.
        </div>
      )}

      <div className="px-4 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Linked sources</h3>
          <span className="font-mono text-xs text-muted-foreground">
            {claim.sources.length}
          </span>
        </div>

        {claim.sources.length ? (
          <div className="mt-3 grid gap-2">
            {claim.sources.map((source) => (
              <SourceRow
                key={source.id}
                onOpenDestination={onOpenDestination}
                source={source}
              />
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-dashed border-border bg-secondary/25 px-4 py-6 text-center">
            <FileSearch
              className="mx-auto h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-2 text-sm font-semibold">No linked source yet</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Add or match evidence to establish this claim.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function SourceRow({
  onOpenDestination,
  source
}: {
  onOpenDestination: (destinationId: CaseDestinationId) => void;
  source: ProofMapSource;
}) {
  const SourceIcon =
    source.kind === "TIMELINE"
      ? CalendarClock
      : source.kind === "STATEMENT"
        ? PenLine
        : FileSearch;
  const destination: CaseDestinationId =
    source.destination === "timeline"
      ? "case-timeline"
      : source.destination === "statement"
        ? "statement-builder"
        : "evidence-intake";

  return (
    <button
      className="proof-interactive-surface group grid min-h-28 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-md border border-border bg-secondary/30 p-3 text-left hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onOpenDestination(destination)}
      type="button"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-primary/10 text-primary">
        <SourceIcon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="break-words text-sm font-semibold text-foreground">
            {source.label}
          </span>
          <Badge variant="secondary">{source.kind.toLowerCase()}</Badge>
        </span>
        <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
          {source.locator}
          {source.confidence !== null
            ? ` · ${Math.round(source.confidence * 100)}% match`
            : ""}
        </span>
        <span className="mt-2 line-clamp-3 block text-xs leading-5 text-muted-foreground">
          {source.excerpt}
        </span>
      </span>
      <ArrowUpRight
        className="mt-1 h-4 w-4 text-muted-foreground group-hover:text-primary"
        aria-hidden="true"
      />
    </button>
  );
}
