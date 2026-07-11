export const helpArticleSlugs = [
  "getting-started",
  "create-first-case",
  "upload-evidence",
  "supported-file-types",
  "organize-evidence",
  "timeline-basics",
  "evidence-checklist",
  "build-appeal-statement",
  "generate-case-packet",
  "prepare-final-packet",
  "review-process",
  "security-and-privacy"
] as const;

export type HelpArticleSlug = (typeof helpArticleSlugs)[number];

export const supportRequestCategories = [
  "CASE_ASSISTANCE",
  "ACCOUNT_ACCESS",
  "BILLING",
  "TECHNICAL",
  "SECURITY_PRIVACY",
  "OTHER"
] as const;

export type SupportRequestCategory = (typeof supportRequestCategories)[number];

export const supportRequestPriorities = ["LOW", "NORMAL", "HIGH"] as const;
export type SupportRequestPriority = (typeof supportRequestPriorities)[number];

export const supportRequestStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;
export type SupportRequestStatus = (typeof supportRequestStatuses)[number];

export interface SupportRequestRecord {
  id: string;
  caseId: string | null;
  category: SupportRequestCategory;
  subject: string;
  message: string;
  priority: SupportRequestPriority;
  status: SupportRequestStatus;
  createdAt: string;
  updatedAt: string;
  case: {
    id: string;
    title: string;
    platform: string;
  } | null;
}

export interface CreateSupportRequestPayload {
  caseId?: string;
  category: SupportRequestCategory;
  subject: string;
  message: string;
  priority: SupportRequestPriority;
}
