export const proofClaimStatuses = [
  "SUPPORTED",
  "WEAK",
  "NEEDS_REVIEW",
  "MISSING"
] as const;

export const proofSourceKinds = [
  "EVIDENCE",
  "TIMELINE",
  "STATEMENT"
] as const;

export type ProofClaimStatus = (typeof proofClaimStatuses)[number];
export type ProofSourceKind = (typeof proofSourceKinds)[number];

export interface ProofMapSource {
  confidence: number | null;
  destination: "evidence" | "statement" | "timeline";
  documentId: string | null;
  eventId: string | null;
  excerpt: string;
  id: string;
  kind: ProofSourceKind;
  label: string;
  locator: string;
}

export interface ProofMapClaim {
  checklistItemId: string;
  description: string;
  gaps: string[];
  id: string;
  label: string;
  sourceKinds: ProofSourceKind[];
  sources: ProofMapSource[];
  status: ProofClaimStatus;
  strength: number;
}

export interface ProofMapResponse {
  caseId: string;
  generatedAt: string;
  summary: {
    coverage: number;
    missing: number;
    needsReview: number;
    supported: number;
    total: number;
    weak: number;
  };
  claims: ProofMapClaim[];
}
