import type { CaseStatus } from "./cases.js";
import type {
  SupportRequestPriority,
  SupportRequestStatus
} from "./support.js";

export const inboxConversationCategories = [
  "SUPPORT",
  "TEAM",
  "CASE_UPDATE",
  "SYSTEM"
] as const;
export type InboxConversationCategory = (typeof inboxConversationCategories)[number];

export const inboxConversationSources = ["SUPPORT_REQUEST", "NOTIFICATION"] as const;
export type InboxConversationSource = (typeof inboxConversationSources)[number];

export const inboxMessageAuthors = ["USER", "SUPPORT", "TEAM", "SYSTEM"] as const;
export type InboxMessageAuthor = (typeof inboxMessageAuthors)[number];

export interface InboxConversationCaseSummary {
  deadline: string | null;
  id: string;
  platform: string;
  status: CaseStatus;
  title: string;
}

export interface InboxConversationRecord {
  canReply: boolean;
  case: InboxConversationCaseSummary | null;
  category: InboxConversationCategory;
  createdAt: string;
  id: string;
  participantName: string;
  preview: string;
  priority: SupportRequestPriority | null;
  readAt: string | null;
  source: InboxConversationSource;
  status: SupportRequestStatus | null;
  subject: string;
  updatedAt: string;
}

export interface InboxMessageRecord {
  author: InboxMessageAuthor;
  body: string;
  createdAt: string;
  id: string;
  senderName: string;
}

export interface InboxConversationDetail extends InboxConversationRecord {
  messages: InboxMessageRecord[];
}

export interface InboxReadStateRecord {
  id: string;
  readAt: string | null;
  source: InboxConversationSource;
}

export interface UpdateInboxReadStateInput {
  read: boolean;
}
