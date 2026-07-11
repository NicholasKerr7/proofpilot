import type {
  SupportRequestCategory,
  SupportRequestPriority,
  SupportRequestStatus
} from "@proofpilot/types";

export const supportCategoryOptions: Array<{
  label: string;
  value: SupportRequestCategory;
}> = [
  { label: "Case assistance", value: "CASE_ASSISTANCE" },
  { label: "Account access", value: "ACCOUNT_ACCESS" },
  { label: "Billing", value: "BILLING" },
  { label: "Technical issue", value: "TECHNICAL" },
  { label: "Security & privacy", value: "SECURITY_PRIVACY" },
  { label: "Other", value: "OTHER" }
];

export const supportPriorityOptions: Array<{
  description: string;
  label: string;
  value: SupportRequestPriority;
}> = [
  { label: "Low", value: "LOW", description: "General question" },
  { label: "Normal", value: "NORMAL", description: "Needs review" },
  { label: "High", value: "HIGH", description: "Deadline or access issue" }
];

export const supportStatusLabels: Record<SupportRequestStatus, string> = {
  OPEN: "Received",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved"
};

export function getSupportCategoryLabel(category: SupportRequestCategory) {
  return supportCategoryOptions.find((option) => option.value === category)?.label ?? category;
}

export function formatSupportRequestReference(id: string) {
  const suffix = id.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();
  return `SUP-${suffix || "REQUEST"}`;
}

export function formatSupportDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
