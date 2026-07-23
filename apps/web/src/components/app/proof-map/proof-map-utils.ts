import type { ProofClaimStatus } from "@proofpilot/types";
import type { CaseStatusVariant } from "@/components/app/cases/case-utils";

export function formatProofClaimStatus(status: ProofClaimStatus) {
  const labels: Record<ProofClaimStatus, string> = {
    MISSING: "Missing",
    NEEDS_REVIEW: "Review",
    SUPPORTED: "Supported",
    WEAK: "Weak"
  };

  return labels[status];
}

export function getProofClaimVariant(
  status: ProofClaimStatus
): CaseStatusVariant | "danger" {
  const variants: Record<
    ProofClaimStatus,
    CaseStatusVariant | "danger"
  > = {
    MISSING: "danger",
    NEEDS_REVIEW: "warning",
    SUPPORTED: "success",
    WEAK: "secondary"
  };

  return variants[status];
}
