import type { AuthUser, CaseRecord } from "@/lib/client/types";

const inactiveCaseStatuses = new Set(["ARCHIVED", "RESOLVED"]);

export function getUserInitials(user: AuthUser) {
  const source = user.name?.trim() || user.email.split("@")[0] || "PP";
  const initials = source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "PP";
}

export function formatMemberSince(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function getAccountCaseMetrics(cases: CaseRecord[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    activeCases: cases.filter((caseRecord) => !inactiveCaseStatuses.has(caseRecord.status)).length,
    evidenceFiles: cases.reduce(
      (total, caseRecord) => total + (caseRecord._count?.documents ?? 0),
      0
    ),
    totalCases: cases.length,
    upcomingDeadlines: cases.filter((caseRecord) => {
      if (!caseRecord.deadline || inactiveCaseStatuses.has(caseRecord.status)) {
        return false;
      }

      const deadline = new Date(caseRecord.deadline);
      return !Number.isNaN(deadline.getTime()) && deadline.getTime() >= today.getTime();
    }).length
  };
}
