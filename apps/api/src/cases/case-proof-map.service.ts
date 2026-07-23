import { Prisma } from "@proofpilot/database";
import type {
  ProofClaimStatus,
  ProofMapClaim,
  ProofMapResponse,
  ProofMapSource,
  ProofSourceKind
} from "@proofpilot/types";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { CaseAccessGuard } from "./case-access.guard.js";

const caseProofMapSelect = {
  id: true,
  checklist: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      description: true,
      label: true,
      status: true,
      matches: {
        orderBy: { confidence: "desc" },
        take: 5,
        select: {
          id: true,
          confidence: true,
          rationale: true,
          document: {
            select: {
              extractedText: true,
              id: true,
              originalName: true,
              status: true
            }
          }
        }
      }
    }
  },
  events: {
    orderBy: [
      { sortOrder: "asc" },
      { occurredAt: "asc" },
      { id: "asc" }
    ],
    select: {
      description: true,
      id: true,
      occurredAt: true,
      title: true,
      sources: {
        select: {
          documentId: true
        }
      }
    }
  },
  statementGuidance: {
    select: {
      accountUse: true,
      actionDate: true,
      platformAction: true,
      reasonGiven: true,
      requestedOutcome: true,
      supportContact: true,
      supportingDocuments: true
    }
  },
  statements: {
    orderBy: { updatedAt: "desc" },
    take: 1,
    select: {
      content: true,
      id: true
    }
  }
} satisfies Prisma.CaseSelect;

type CaseProofMapRecord = Prisma.CaseGetPayload<{
  select: typeof caseProofMapSelect;
}>;

/** Builds the read-only claim graph from records already reviewed inside a case. */
export class CaseProofMapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CaseAccessGuard
  ) {}

  async get(userId: string, caseId: string): Promise<ProofMapResponse> {
    await this.access.require(userId, caseId, "READ");
    const caseRecord = await this.prisma.case.findUniqueOrThrow({
      where: { id: caseId },
      select: caseProofMapSelect
    });

    return buildProofMapResponse(caseRecord);
  }
}

export function buildProofMapResponse(
  caseRecord: CaseProofMapRecord,
  generatedAt = new Date()
): ProofMapResponse {
  const claims = caseRecord.checklist.map((item) =>
    buildClaim(caseRecord, item)
  );
  const statusCounts = {
    missing: claims.filter((claim) => claim.status === "MISSING").length,
    needsReview: claims.filter((claim) => claim.status === "NEEDS_REVIEW").length,
    supported: claims.filter((claim) => claim.status === "SUPPORTED").length,
    weak: claims.filter((claim) => claim.status === "WEAK").length
  };
  const coverage = claims.length
    ? Math.round(
        claims.reduce((total, claim) => total + claim.strength, 0) /
          claims.length
      )
    : 0;

  return {
    caseId: caseRecord.id,
    claims,
    generatedAt: generatedAt.toISOString(),
    summary: {
      coverage,
      ...statusCounts,
      total: claims.length
    }
  };
}

function buildClaim(
  caseRecord: CaseProofMapRecord,
  checklistItem: CaseProofMapRecord["checklist"][number]
): ProofMapClaim {
  const normalizedLabel = checklistItem.label.toLowerCase();
  const evidenceSources = checklistItem.matches.map((match) => ({
    confidence: match.confidence,
    destination: "evidence" as const,
    documentId: match.document.id,
    eventId: null,
    excerpt:
      findRelevantExcerpt(
        match.document.extractedText,
        `${checklistItem.label} ${checklistItem.description}`
      ) ??
      match.rationale ??
      "This evidence was matched to the claim, but no extracted passage is available.",
    id: `evidence:${match.id}`,
    kind: "EVIDENCE" as const,
    label: match.document.originalName,
    locator:
      match.document.status === "PROCESSED"
        ? "Verified extraction"
        : "Evidence pending review"
  }));
  const matchedDocumentIds = new Set(
    evidenceSources.flatMap((source) =>
      source.documentId ? [source.documentId] : []
    )
  );
  const timelineSources = caseRecord.events
    .filter((event) => {
      if (!event.sources.length) {
        return false;
      }

      return (
        normalizedLabel.includes("date") ||
        event.sources.some((source) => matchedDocumentIds.has(source.documentId))
      );
    })
    .map((event) => ({
      confidence: null,
      destination: "timeline" as const,
      documentId: null,
      eventId: event.id,
      excerpt: event.description ?? event.title,
      id: `timeline:${event.id}`,
      kind: "TIMELINE" as const,
      label: event.title,
      locator: new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeZone: "UTC"
      }).format(event.occurredAt)
    }));
  const statementSource = buildStatementSource(caseRecord, normalizedLabel);
  const sources = [
    ...evidenceSources,
    ...timelineSources,
    ...(statementSource ? [statementSource] : [])
  ];
  const sourceKinds = [...new Set(sources.map((source) => source.kind))];
  const status = resolveClaimStatus(checklistItem.status, sources.length);

  return {
    checklistItemId: checklistItem.id,
    description: checklistItem.description,
    gaps: buildGaps(normalizedLabel, status, sourceKinds),
    id: `claim:${checklistItem.id}`,
    label: formatClaimLabel(checklistItem.label),
    sourceKinds,
    sources,
    status,
    strength: calculateClaimStrength(status, sourceKinds.length)
  };
}

function buildStatementSource(
  caseRecord: CaseProofMapRecord,
  normalizedLabel: string
): ProofMapSource | null {
  const guidance = caseRecord.statementGuidance;
  const statement = caseRecord.statements[0];
  let excerpt: string | null = null;
  let label = "Appeal statement";

  if (normalizedLabel.includes("restriction")) {
    excerpt = joinPresent(guidance?.platformAction, guidance?.reasonGiven);
    label = "Account action and reason";
  } else if (normalizedLabel.includes("support")) {
    excerpt = guidance?.supportContact ?? null;
    label = "Support history";
  } else if (normalizedLabel.includes("user explanation")) {
    excerpt =
      joinPresent(statement?.content, guidance?.requestedOutcome) || null;
    label = "Appeal argument";
  } else if (
    normalizedLabel.includes("transaction") ||
    normalizedLabel.includes("activity")
  ) {
    excerpt = guidance?.accountUse ?? null;
    label = "Account activity explanation";
  } else if (normalizedLabel.includes("ownership")) {
    excerpt = includesOwnershipLanguage(guidance?.supportingDocuments)
      ? guidance?.supportingDocuments ?? null
      : null;
    label = "Ownership explanation";
  } else if (normalizedLabel.includes("date")) {
    excerpt = guidance?.actionDate ?? null;
    label = "Action date";
  }

  if (!excerpt?.trim()) {
    return null;
  }

  return {
    confidence: null,
    destination: "statement",
    documentId: null,
    eventId: null,
    excerpt: truncate(excerpt, 320),
    id: `statement:${statement?.id ?? caseRecord.id}:${normalizedLabel}`,
    kind: "STATEMENT",
    label,
    locator: statement ? "Current statement" : "Statement guidance"
  };
}

function resolveClaimStatus(
  checklistStatus: string,
  sourceCount: number
): ProofClaimStatus {
  if (checklistStatus === "FOUND" || checklistStatus === "COMPLETE") {
    return sourceCount > 0 ? "SUPPORTED" : "WEAK";
  }

  if (checklistStatus === "NEEDS_REVIEW") {
    return "NEEDS_REVIEW";
  }

  return sourceCount > 0 ? "WEAK" : "MISSING";
}

function calculateClaimStrength(
  status: ProofClaimStatus,
  sourceKindCount: number
) {
  if (status === "SUPPORTED") {
    return Math.min(96, 70 + sourceKindCount * 9);
  }

  if (status === "NEEDS_REVIEW") {
    return Math.min(62, 38 + sourceKindCount * 8);
  }

  if (status === "WEAK") {
    return Math.min(58, 26 + sourceKindCount * 10);
  }

  return 10;
}

function buildGaps(
  normalizedLabel: string,
  status: ProofClaimStatus,
  sourceKinds: ProofSourceKind[]
) {
  if (status === "SUPPORTED" && sourceKinds.length >= 2) {
    return [];
  }

  const gaps: string[] = [];

  if (!sourceKinds.includes("EVIDENCE")) {
    gaps.push("Attach documentary evidence that directly supports this claim.");
  }

  if (
    normalizedLabel.includes("date") &&
    !sourceKinds.includes("TIMELINE")
  ) {
    gaps.push("Link a dated timeline event to its source evidence.");
  }

  if (
    normalizedLabel.includes("explanation") &&
    !sourceKinds.includes("STATEMENT")
  ) {
    gaps.push("State this argument and the requested outcome in the appeal.");
  }

  if (status === "NEEDS_REVIEW") {
    gaps.push("Verify the evidence match before relying on it.");
  } else if (sourceKinds.length === 1) {
    gaps.push("Connect another independent source to strengthen the claim.");
  }

  return gaps.slice(0, 2);
}

function formatClaimLabel(label: string) {
  const normalized = label.toLowerCase();

  if (normalized.includes("restriction")) {
    return "The account action is documented";
  }

  if (normalized.includes("support")) {
    return "Support history is verifiable";
  }

  if (normalized.includes("user explanation")) {
    return "The appeal request is clearly argued";
  }

  if (normalized.includes("transaction") || normalized.includes("activity")) {
    return "Legitimate account activity has context";
  }

  if (normalized.includes("ownership")) {
    return "Account ownership is established";
  }

  if (normalized.includes("date")) {
    return "The chronology is anchored to evidence";
  }

  return label;
}

function findRelevantExcerpt(
  extractedText: string | null,
  searchText: string
) {
  if (!extractedText?.trim()) {
    return null;
  }

  const normalizedText = extractedText.replace(/\s+/g, " ").trim();
  const terms = searchText
    .toLowerCase()
    .match(/[a-z0-9]{4,}/g)
    ?.filter((term) => !excerptStopWords.has(term));
  const matchIndex =
    terms
      ?.map((term) => normalizedText.toLowerCase().indexOf(term))
      .find((index) => index >= 0) ?? 0;
  const start = Math.max(0, matchIndex - 70);
  const excerpt = normalizedText.slice(start, start + 320);

  return `${start > 0 ? "..." : ""}${excerpt}${
    start + excerpt.length < normalizedText.length ? "..." : ""
  }`;
}

function includesOwnershipLanguage(value: string | null | undefined) {
  if (
    !value ||
    /\b(collecting|gathering|missing|need|needs|pending|required|still)\b/i.test(
      value
    )
  ) {
    return false;
  }

  return /\b(account|address|identity|name|owner|ownership|profile)\b/i.test(
    value
  );
}

function joinPresent(...values: Array<string | null | undefined>) {
  return values
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

const excerptStopWords = new Set([
  "account",
  "clear",
  "evidence",
  "showing",
  "such",
  "that",
  "this",
  "user",
  "with"
]);
