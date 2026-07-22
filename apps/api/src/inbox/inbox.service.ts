import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@proofpilot/database";
import {
  inboxConversationSources,
  type CaseStatus,
  type InboxConversationCategory,
  type InboxConversationDetail,
  type InboxConversationRecord,
  type InboxConversationSource,
  type InboxMessageAuthor,
  type InboxReadStateRecord
} from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";

const supportNotificationPrefix = "support.request_";

const inboxCaseSelect = {
  id: true,
  deadline: true,
  platform: true,
  status: true,
  title: true
} satisfies Prisma.CaseSelect;

const supportConversationSelect = {
  id: true,
  category: true,
  subject: true,
  message: true,
  priority: true,
  status: true,
  readAt: true,
  createdAt: true,
  updatedAt: true,
  case: { select: inboxCaseSelect },
  messages: {
    orderBy: { createdAt: "desc" },
    select: {
      author: true,
      message: true,
      createdAt: true
    },
    take: 1
  }
} satisfies Prisma.SupportRequestSelect;

const supportConversationDetailSelect = {
  ...supportConversationSelect,
  messages: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      author: true,
      message: true,
      createdAt: true
    }
  }
} satisfies Prisma.SupportRequestSelect;

const notificationConversationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  readAt: true,
  createdAt: true,
  case: { select: inboxCaseSelect }
} satisfies Prisma.NotificationSelect;

type SupportConversationRow = Prisma.SupportRequestGetPayload<{
  select: typeof supportConversationSelect;
}>;
type SupportConversationDetailRow = Prisma.SupportRequestGetPayload<{
  select: typeof supportConversationDetailSelect;
}>;
type NotificationConversationRow = Prisma.NotificationGetPayload<{
  select: typeof notificationConversationSelect;
}>;

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<InboxConversationRecord[]> {
    const [supportRequests, notifications] = await Promise.all([
      this.prisma.supportRequest.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: supportConversationSelect,
        take: 30
      }),
      this.prisma.notification.findMany({
        where: {
          userId,
          inAppVisible: true,
          OR: [{ caseId: null }, { case: { archivedAt: null } }],
          NOT: { type: { startsWith: supportNotificationPrefix } }
        },
        orderBy: { createdAt: "desc" },
        select: notificationConversationSelect,
        take: 50
      })
    ]);

    return [
      ...supportRequests.map(toSupportConversation),
      ...notifications.map(toNotificationConversation)
    ]
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, 80);
  }

  async get(
    userId: string,
    sourceInput: string,
    conversationId: string
  ): Promise<InboxConversationDetail> {
    const source = parseConversationSource(sourceInput);

    if (source === "SUPPORT_REQUEST") {
      const request = await this.prisma.supportRequest.findFirst({
        where: { id: conversationId, userId },
        select: supportConversationDetailSelect
      });

      if (!request) {
        throw new NotFoundException("Inbox conversation not found.");
      }

      return toSupportConversationDetail(request);
    }

    const notification = await this.prisma.notification.findFirst({
      where: {
        id: conversationId,
        userId,
        inAppVisible: true,
        OR: [{ caseId: null }, { case: { archivedAt: null } }],
        NOT: { type: { startsWith: supportNotificationPrefix } }
      },
      select: notificationConversationSelect
    });

    if (!notification) {
      throw new NotFoundException("Inbox conversation not found.");
    }

    return toNotificationConversationDetail(notification);
  }

  async updateReadState(
    userId: string,
    sourceInput: string,
    conversationId: string,
    read: boolean
  ): Promise<InboxReadStateRecord> {
    const source = parseConversationSource(sourceInput);
    const readAt = read ? new Date() : null;

    if (source === "SUPPORT_REQUEST") {
      const request = await this.prisma.supportRequest.findFirst({
        where: { id: conversationId, userId },
        select: { id: true }
      });

      if (!request) {
        throw new NotFoundException("Inbox conversation not found.");
      }

      const updatedRequest = await this.prisma.supportRequest.update({
        where: { id: request.id },
        data: { readAt },
        select: { id: true, readAt: true }
      });

      return toReadState(source, updatedRequest);
    }

    const notification = await this.prisma.notification.findFirst({
      where: {
        id: conversationId,
        userId,
        inAppVisible: true,
        OR: [{ caseId: null }, { case: { archivedAt: null } }],
        NOT: { type: { startsWith: supportNotificationPrefix } }
      },
      select: { id: true }
    });

    if (!notification) {
      throw new NotFoundException("Inbox conversation not found.");
    }

    const updatedNotification = await this.prisma.notification.update({
      where: { id: notification.id },
      data: { readAt },
      select: { id: true, readAt: true }
    });

    return toReadState(source, updatedNotification);
  }

  async markAllRead(userId: string) {
    const readAt = new Date();
    const [supportRequests, notifications] = await this.prisma.$transaction([
      this.prisma.supportRequest.updateMany({
        where: { userId, readAt: null },
        data: { readAt }
      }),
      this.prisma.notification.updateMany({
        where: {
          userId,
          inAppVisible: true,
          readAt: null,
          OR: [{ caseId: null }, { case: { archivedAt: null } }],
          NOT: { type: { startsWith: supportNotificationPrefix } }
        },
        data: { readAt }
      })
    ]);

    return {
      readAt: readAt.toISOString(),
      updatedCount: supportRequests.count + notifications.count
    };
  }
}

function parseConversationSource(value: string): InboxConversationSource {
  if (!inboxConversationSources.includes(value as InboxConversationSource)) {
    throw new BadRequestException("Inbox conversation source is invalid.");
  }

  return value as InboxConversationSource;
}

function toSupportConversation(request: SupportConversationRow): InboxConversationRecord {
  const latestMessage = request.messages.reduce<(typeof request.messages)[number] | null>(
    (latest, message) =>
      !latest || message.createdAt.getTime() > latest.createdAt.getTime()
        ? message
        : latest,
    null
  );

  return {
    canReply: request.status !== "RESOLVED",
    case: toCaseSummary(request.case),
    category: "SUPPORT",
    createdAt: request.createdAt.toISOString(),
    id: request.id,
    participantName: "ProofPilot Support",
    preview: latestMessage?.message ?? request.message,
    priority: request.priority,
    readAt: request.readAt?.toISOString() ?? null,
    source: "SUPPORT_REQUEST",
    status: request.status,
    subject: request.subject,
    updatedAt: (latestMessage?.createdAt ?? request.createdAt).toISOString()
  };
}

function toSupportConversationDetail(
  request: SupportConversationDetailRow
): InboxConversationDetail {
  return {
    ...toSupportConversation(request),
    messages: [
      {
        author: "USER",
        body: request.message,
        createdAt: request.createdAt.toISOString(),
        id: `${request.id}-initial`,
        senderName: "You"
      },
      ...request.messages.map((message) => ({
        author: toInboxMessageAuthor(message.author),
        body: message.message,
        createdAt: message.createdAt.toISOString(),
        id: message.id,
        senderName: getSupportSenderName(message.author)
      }))
    ]
  };
}

function toNotificationConversation(
  notification: NotificationConversationRow
): InboxConversationRecord {
  const category = getNotificationCategory(notification.type);

  return {
    canReply: false,
    case: toCaseSummary(notification.case),
    category,
    createdAt: notification.createdAt.toISOString(),
    id: notification.id,
    participantName: getNotificationParticipant(notification.type, category),
    preview: notification.body,
    priority: null,
    readAt: notification.readAt?.toISOString() ?? null,
    source: "NOTIFICATION",
    status: null,
    subject: notification.title,
    updatedAt: notification.createdAt.toISOString()
  };
}

function toNotificationConversationDetail(
  notification: NotificationConversationRow
): InboxConversationDetail {
  const conversation = toNotificationConversation(notification);
  const author: InboxMessageAuthor = conversation.category === "TEAM" ? "TEAM" : "SYSTEM";

  return {
    ...conversation,
    messages: [
      {
        author,
        body: notification.body,
        createdAt: notification.createdAt.toISOString(),
        id: notification.id,
        senderName: conversation.participantName
      }
    ]
  };
}

function getNotificationCategory(type: string): InboxConversationCategory {
  if (type.startsWith("collaboration_") || type.startsWith("inbox_team_")) {
    return "TEAM";
  }

  if (
    type.startsWith("case_") ||
    type.startsWith("processing_") ||
    type.startsWith("document_")
  ) {
    return "CASE_UPDATE";
  }

  return "SYSTEM";
}

function getNotificationParticipant(
  type: string,
  category: InboxConversationCategory
) {
  if (category === "TEAM") {
    return "Case team";
  }

  if (category === "CASE_UPDATE") {
    return "Case updates";
  }

  if (type.startsWith("packet_")) {
    return "Packet Generation";
  }

  if (type.startsWith("deadline_")) {
    return "Reminder Alerts";
  }

  return "ProofPilot System";
}

function toInboxMessageAuthor(author: string): InboxMessageAuthor {
  if (author === "USER" || author === "SUPPORT" || author === "SYSTEM") {
    return author;
  }

  return "SYSTEM";
}

function getSupportSenderName(author: string) {
  if (author === "USER") {
    return "You";
  }

  if (author === "SUPPORT") {
    return "ProofPilot Support";
  }

  return "ProofPilot System";
}

function toCaseSummary(
  caseRecord: {
    deadline: Date | null;
    id: string;
    platform: string;
    status: string;
    title: string;
  } | null
) {
  if (!caseRecord) {
    return null;
  }

  return {
    deadline: caseRecord.deadline?.toISOString() ?? null,
    id: caseRecord.id,
    platform: caseRecord.platform,
    status: caseRecord.status as CaseStatus,
    title: caseRecord.title
  };
}

function toReadState(
  source: InboxConversationSource,
  record: { id: string; readAt: Date | null }
): InboxReadStateRecord {
  return {
    id: record.id,
    readAt: record.readAt?.toISOString() ?? null,
    source
  };
}
