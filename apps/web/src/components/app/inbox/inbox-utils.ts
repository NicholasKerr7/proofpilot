import type {
  InboxConversationCategory,
  InboxConversationRecord,
  InboxConversationSource
} from "@proofpilot/types";

export type InboxFilter =
  | "ALL"
  | "UNREAD"
  | InboxConversationCategory;
export type InboxSort = "NEWEST" | "OLDEST";

export const inboxCategoryOptions: Array<{
  label: string;
  value: InboxConversationCategory;
}> = [
  { label: "Support", value: "SUPPORT" },
  { label: "Team", value: "TEAM" },
  { label: "Case updates", value: "CASE_UPDATE" },
  { label: "System", value: "SYSTEM" }
];

export function getInboxConversationKey(input: {
  id: string;
  source: InboxConversationSource;
}) {
  return `${input.source}:${input.id}`;
}

export function getInboxCategoryLabel(category: InboxConversationCategory) {
  return inboxCategoryOptions.find((option) => option.value === category)?.label ?? category;
}

export function getInboxCategoryVariant(category: InboxConversationCategory) {
  if (category === "SUPPORT") {
    return "default" as const;
  }

  if (category === "TEAM") {
    return "success" as const;
  }

  if (category === "CASE_UPDATE") {
    return "warning" as const;
  }

  return "secondary" as const;
}

export function matchesInboxFilter(
  conversation: InboxConversationRecord,
  filter: InboxFilter
) {
  if (filter === "ALL") {
    return true;
  }

  if (filter === "UNREAD") {
    return !conversation.readAt;
  }

  return conversation.category === filter;
}

export function matchesInboxSearch(
  conversation: InboxConversationRecord,
  searchQuery: string
) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    conversation.participantName,
    conversation.subject,
    conversation.preview,
    conversation.case?.title,
    conversation.case?.platform
  ].some((value) => value?.toLowerCase().includes(normalizedQuery));
}

export function sortInboxConversations(
  conversations: InboxConversationRecord[],
  sort: InboxSort
) {
  const direction = sort === "NEWEST" ? -1 : 1;

  return [...conversations].sort(
    (left, right) =>
      direction * (Date.parse(left.updatedAt) - Date.parse(right.updatedAt))
  );
}

export function formatInboxListDate(value: string, now = new Date()) {
  const date = new Date(value);
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short"
  }).format(date);
}

export function formatInboxMessageDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}
