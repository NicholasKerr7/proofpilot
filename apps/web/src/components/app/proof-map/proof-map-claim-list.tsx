import type { ProofMapClaim } from "@proofpilot/types";
import {
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  ScanSearch,
  TriangleAlert
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatProofClaimStatus,
  getProofClaimVariant
} from "@/components/app/proof-map/proof-map-utils";

interface ProofMapClaimListProps {
  claims: ProofMapClaim[];
  onSelect: (claimId: string) => void;
  selectedClaimId: string;
}

export function ProofMapClaimList({
  claims,
  onSelect,
  selectedClaimId
}: ProofMapClaimListProps) {
  return (
    <section
      aria-labelledby="proof-claims-heading"
      className="min-w-0 border-b border-border md:border-b-0 md:border-r"
    >
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 id="proof-claims-heading" className="text-sm font-semibold">
          Appeal claims
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {claims.length} required arguments
        </p>
      </div>

      <div className="md:max-h-[46rem] md:overflow-y-auto scroll-container">
        {claims.map((claim) => {
          const StatusIcon =
            claim.status === "SUPPORTED"
              ? CheckCircle2
              : claim.status === "NEEDS_REVIEW"
                ? ScanSearch
                : claim.status === "WEAK"
                  ? TriangleAlert
                  : CircleDashed;
          const isSelected = claim.id === selectedClaimId;

          return (
            <button
              aria-current={isSelected ? "true" : undefined}
              className={cn(
                "grid min-h-28 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-border px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-secondary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5",
                isSelected ? "bg-primary/10" : null
              )}
              key={claim.id}
              onClick={() => onSelect(claim.id)}
              type="button"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border",
                  claim.status === "SUPPORTED"
                    ? "border-teal-400/30 bg-teal-400/10 text-teal-200"
                    : claim.status === "MISSING"
                      ? "border-red-400/30 bg-red-400/10 text-red-200"
                      : "border-primary/25 bg-primary/10 text-primary"
                )}
              >
                <StatusIcon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5 text-foreground">
                  {claim.label}
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={getProofClaimVariant(claim.status)}>
                    {formatProofClaimStatus(claim.status)}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {claim.sources.length}{" "}
                    {claim.sources.length === 1 ? "source" : "sources"}
                  </span>
                </span>
              </span>
              <ChevronRight
                className={cn(
                  "mt-2 h-4 w-4 text-muted-foreground",
                  isSelected ? "text-primary" : null
                )}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
