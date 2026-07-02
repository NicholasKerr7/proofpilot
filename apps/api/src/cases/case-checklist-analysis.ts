import { ChecklistStatus } from "@proofpilot/database";

interface ChecklistEvidenceDocument {
  id: string;
  originalName: string;
  mimeType: string;
  extractedText: string | null;
  entities: {
    type: string;
    value: string;
  }[];
}

interface ChecklistEvidenceItem {
  id: string;
  label: string;
  description: string;
  requirementId: string | null;
  status: ChecklistStatus;
}

interface AnalyzeChecklistInput {
  caseSummary: string | null;
  checklist: ChecklistEvidenceItem[];
  documents: ChecklistEvidenceDocument[];
}

export interface ChecklistAnalysisResult {
  checklistItemId: string;
  requirementId: string | null;
  status: ChecklistStatus;
  match: ChecklistAnalysisMatch | null;
}

export interface ChecklistAnalysisMatch {
  documentId: string;
  confidence: number;
  rationale: string;
}

interface RequirementRule {
  name: string;
  appliesTo: (text: string) => boolean;
  keywords: string[];
  entityTypes?: string[];
  threshold: number;
  imageEvidence?: boolean;
  summaryCanComplete?: boolean;
}

const requirementRules: RequirementRule[] = [
  {
    name: "account action notice",
    appliesTo: (text) => includesAny(text, ["closure", "restriction", "screenshot"]),
    keywords: [
      "account closed",
      "account closure",
      "restriction",
      "restricted",
      "suspended",
      "suspension",
      "disabled",
      "deactivated",
      "terminated",
      "banned",
      "hold",
      "notice",
      "screenshot",
      "limited",
      "permanently limited"
    ],
    threshold: 0.5,
    imageEvidence: true
  },
  {
    name: "support conversation",
    appliesTo: (text) => includesAny(text, ["support", "conversation", "ticket"]),
    keywords: [
      "support",
      "ticket",
      "case number",
      "appeal",
      "chat",
      "agent",
      "response",
      "conversation",
      "email",
      "replied"
    ],
    entityTypes: ["EMAIL"],
    threshold: 0.45
  },
  {
    name: "user explanation",
    appliesTo: (text) => includesAny(text, ["user explanation", "statement", "explaining"]),
    keywords: ["i believe", "my account", "i was", "i did", "explanation", "statement", "requested outcome"],
    threshold: 0.55,
    summaryCanComplete: true
  },
  {
    name: "transaction or activity context",
    appliesTo: (text) => includesAny(text, ["transaction", "activity", "receipt"]),
    keywords: [
      "transaction",
      "payment",
      "receipt",
      "order",
      "invoice",
      "refund",
      "chargeback",
      "payout",
      "activity",
      "purchase"
    ],
    entityTypes: ["AMOUNT"],
    threshold: 0.55
  },
  {
    name: "account ownership proof",
    appliesTo: (text) => includesAny(text, ["ownership", "account ownership", "profile"]),
    keywords: ["account email", "profile", "username", "login", "owner", "ownership", "verification", "identity"],
    entityTypes: ["EMAIL"],
    threshold: 0.5
  },
  {
    name: "relevant dates",
    appliesTo: (text) => includesAny(text, ["date", "deadline", "dates"]),
    keywords: ["date", "deadline", "received", "submitted", "notice", "appeal date", "closed on"],
    entityTypes: ["DATE"],
    threshold: 0.45
  }
];

export function analyzeChecklistEvidence({
  caseSummary,
  checklist,
  documents
}: AnalyzeChecklistInput): ChecklistAnalysisResult[] {
  return checklist.map((item) => {
    const itemText = `${item.label} ${item.description}`.toLowerCase();
    const rule = requirementRules.find((candidate) => candidate.appliesTo(itemText));

    if (rule?.summaryCanComplete && hasMeaningfulSummary(caseSummary)) {
      return {
        checklistItemId: item.id,
        requirementId: item.requirementId,
        status: ChecklistStatus.COMPLETE,
        match: null
      };
    }

    const match = rule
      ? findBestRuleMatch(documents, rule)
      : findBestFallbackMatch(documents, tokenizeRequirement(itemText));

    return {
      checklistItemId: item.id,
      requirementId: item.requirementId,
      status: match ? ChecklistStatus.FOUND : getMissingStatus(item.status),
      match
    };
  });
}

function findBestRuleMatch(documents: ChecklistEvidenceDocument[], rule: RequirementRule) {
  let bestMatch: ChecklistAnalysisMatch | null = null;

  for (const document of documents) {
    const source = createSearchableDocumentText(document);
    const hits: string[] = [];
    let score = 0;

    for (const keyword of rule.keywords) {
      if (source.includes(keyword)) {
        hits.push(keyword);
        score += keyword.includes(" ") ? 0.22 : 0.14;
      }
    }

    for (const entityType of rule.entityTypes ?? []) {
      if (document.entities.some((entity) => entity.type === entityType)) {
        hits.push(entityType.toLowerCase());
        score += 0.32;
      }
    }

    if (rule.imageEvidence && isLikelyScreenshotEvidence(document)) {
      hits.push("image evidence");
      score += 0.42;
    }

    const confidence = clampConfidence(score);

    if (confidence >= rule.threshold && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = {
        documentId: document.id,
        confidence,
        rationale: createRationale(rule.name, document.originalName, hits)
      };
    }
  }

  return bestMatch;
}

function findBestFallbackMatch(documents: ChecklistEvidenceDocument[], tokens: string[]) {
  if (!tokens.length) {
    return null;
  }

  let bestMatch: ChecklistAnalysisMatch | null = null;

  for (const document of documents) {
    const source = createSearchableDocumentText(document);
    const hits = tokens.filter((token) => source.includes(token));
    const confidence = clampConfidence(hits.length * 0.16);

    if (confidence >= 0.48 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = {
        documentId: document.id,
        confidence,
        rationale: createRationale("checklist requirement", document.originalName, hits)
      };
    }
  }

  return bestMatch;
}

function createSearchableDocumentText(document: ChecklistEvidenceDocument) {
  return [
    document.originalName,
    document.mimeType,
    document.extractedText ?? "",
    ...document.entities.flatMap((entity) => [entity.type, entity.value])
  ]
    .join(" ")
    .toLowerCase();
}

function createRationale(ruleName: string, originalName: string, hits: string[]) {
  const uniqueHits = [...new Set(hits)].slice(0, 4);

  if (!uniqueHits.length) {
    return `Matched ${ruleName} evidence in ${originalName}.`;
  }

  return `Matched ${ruleName} evidence in ${originalName}: ${uniqueHits.join(", ")}.`;
}

function getMissingStatus(currentStatus: ChecklistStatus) {
  return currentStatus === ChecklistStatus.OPTIONAL ? ChecklistStatus.OPTIONAL : ChecklistStatus.MISSING;
}

function isLikelyScreenshotEvidence(document: ChecklistEvidenceDocument) {
  const name = document.originalName.toLowerCase();
  return (
    document.mimeType.startsWith("image/") ||
    name.includes("screenshot") ||
    name.includes("notice") ||
    name.includes("restriction") ||
    name.includes("closure")
  );
}

function includesAny(value: string, candidates: string[]) {
  return candidates.some((candidate) => value.includes(candidate));
}

function tokenizeRequirement(value: string) {
  return value
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 5)
    .filter((token) => !["evidence", "account", "proof"].includes(token))
    .slice(0, 8);
}

function hasMeaningfulSummary(value: string | null) {
  return Boolean(value && value.trim().length >= 40);
}

function clampConfidence(value: number) {
  return Math.min(0.96, Math.max(0, Number(value.toFixed(2))));
}
