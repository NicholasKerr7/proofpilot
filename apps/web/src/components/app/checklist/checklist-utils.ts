export type ChecklistGroupKey = "ready" | "missing" | "review" | "optional";
export type ChecklistFilter = "all" | ChecklistGroupKey;

export function matchesChecklistFilter(status: string, filter: ChecklistFilter) {
  if (filter === "all") {
    return true;
  }

  return getChecklistGroupKey(status) === filter;
}

export function getChecklistGroupKey(status: string): ChecklistGroupKey {
  if (isChecklistReady(status)) {
    return "ready";
  }

  if (status === "NEEDS_REVIEW") {
    return "review";
  }

  if (status === "OPTIONAL") {
    return "optional";
  }

  return "missing";
}

export function isChecklistReady(status: string) {
  return status === "FOUND" || status === "COMPLETE";
}

export function formatChecklistStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getChecklistStatusVariant(
  status: string
): "secondary" | "success" | "warning" {
  if (isChecklistReady(status)) {
    return "success";
  }

  if (status === "OPTIONAL") {
    return "secondary";
  }

  return "warning";
}

export function formatChecklistDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}
