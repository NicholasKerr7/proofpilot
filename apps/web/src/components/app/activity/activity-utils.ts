import type {
  CaseActivityCategory,
  CaseActivityItem,
  CaseActivityItemCategory
} from "@proofpilot/types";

export const activityFilters: Array<{
  label: string;
  value: CaseActivityCategory;
}> = [
  { label: "All activity", value: "all" },
  { label: "Case updates", value: "case" },
  { label: "Evidence", value: "evidence" },
  { label: "Timeline", value: "timeline" },
  { label: "Checklist", value: "checklist" },
  { label: "Statement", value: "statement" },
  { label: "Packet", value: "packet" },
  { label: "Reminders", value: "reminder" }
];

interface ActivityGroup {
  dateLabel: string;
  items: CaseActivityItem[];
  key: string;
  relativeLabel: string;
}

export function groupActivityItems(items: CaseActivityItem[]): ActivityGroup[] {
  const groups = new Map<string, CaseActivityItem[]>();

  for (const item of items) {
    const date = new Date(item.createdAt);
    const key = getLocalDateKey(date);
    const currentItems = groups.get(key) ?? [];
    currentItems.push(item);
    groups.set(key, currentItems);
  }

  return Array.from(groups, ([key, groupedItems]) => {
    const date = new Date(groupedItems[0]?.createdAt ?? key);

    return {
      dateLabel: formatActivityDate(date),
      items: groupedItems,
      key,
      relativeLabel: getRelativeDateLabel(date)
    };
  });
}

export function matchesActivitySearch(item: CaseActivityItem, searchQuery: string) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [item.title, item.detail, getActivityCategoryLabel(item.category)]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

export function formatActivityTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function getActivityCategoryLabel(category: CaseActivityItemCategory) {
  return activityFilters.find((filter) => filter.value === category)?.label ?? "Case update";
}

export function getActivityBadgeVariant(item: CaseActivityItem) {
  if (item.action.endsWith("failed") || item.action.endsWith("rejected")) {
    return "danger" as const;
  }

  switch (item.category) {
    case "checklist":
      return "success" as const;
    case "reminder":
      return "warning" as const;
    case "case":
    case "timeline":
      return "secondary" as const;
    default:
      return "default" as const;
  }
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRelativeDateLabel(date: Date) {
  const target = startOfDay(date);
  const today = startOfDay(new Date());
  const differenceInDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  if (differenceInDays === 0) {
    return "Today";
  }

  if (differenceInDays === 1) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long"
  }).format(date);
}

function formatActivityDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}
