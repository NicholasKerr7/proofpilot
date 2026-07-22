import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@proofpilot/database";
import {
  helpArticleSlugs,
  type HelpArticleSlug,
  type SupportRequestDetailRecord,
  type SupportRequestMessageRecord,
  type SupportRequestRecord
} from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateSupportRequestMessageDto } from "./dto/create-support-request-message.dto.js";
import type { CreateSupportRequestDto } from "./dto/create-support-request.dto.js";
import type { RecordArticleFeedbackDto } from "./dto/record-article-feedback.dto.js";

const supportRequestSelect = {
  id: true,
  caseId: true,
  category: true,
  subject: true,
  message: true,
  priority: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  case: {
    select: {
      id: true,
      title: true,
      platform: true
    }
  }
} satisfies Prisma.SupportRequestSelect;

type SupportRequestRow = Prisma.SupportRequestGetPayload<{ select: typeof supportRequestSelect }>;

const supportRequestMessageSelect = {
  id: true,
  requestId: true,
  author: true,
  message: true,
  createdAt: true
} satisfies Prisma.SupportRequestMessageSelect;

const supportRequestDetailSelect = {
  ...supportRequestSelect,
  messages: {
    orderBy: { createdAt: "asc" },
    select: supportRequestMessageSelect
  }
} satisfies Prisma.SupportRequestSelect;

type SupportRequestDetailRow = Prisma.SupportRequestGetPayload<{
  select: typeof supportRequestDetailSelect;
}>;
type SupportRequestMessageRow = Prisma.SupportRequestMessageGetPayload<{
  select: typeof supportRequestMessageSelect;
}>;

const validArticleSlugs = new Set<HelpArticleSlug>(helpArticleSlugs);

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async listRequests(ownerId: string): Promise<SupportRequestRecord[]> {
    const requests = await this.prisma.supportRequest.findMany({
      where: { userId: ownerId },
      orderBy: { updatedAt: "desc" },
      select: supportRequestSelect,
      take: 20
    });

    return requests.map(toSupportRequestRecord);
  }

  async createRequest(
    ownerId: string,
    input: CreateSupportRequestDto
  ): Promise<SupportRequestRecord> {
    const subject = input.subject.trim();
    const message = input.message.trim();

    if (subject.length < 5 || message.length < 20) {
      throw new BadRequestException("Support request subject or message is too short.");
    }

    const selectedCase = input.caseId
      ? await this.prisma.case.findFirst({
          where: {
            id: input.caseId,
            ownerId,
            archivedAt: null
          },
          select: {
            id: true,
            title: true
          }
        })
      : null;

    if (input.caseId && !selectedCase) {
      throw new NotFoundException("Case not found.");
    }

    const request = await this.prisma.$transaction(async (tx) => {
      const createdRequest = await tx.supportRequest.create({
        data: {
          userId: ownerId,
          ...(selectedCase ? { caseId: selectedCase.id } : {}),
          category: input.category,
          subject,
          message,
          priority: input.priority,
          readAt: new Date()
        },
        select: supportRequestSelect
      });

      await tx.notification.create({
        data: {
          userId: ownerId,
          ...(selectedCase ? { caseId: selectedCase.id } : {}),
          type: `support.request_received:${createdRequest.id}`,
          title: "Support request received",
          body: selectedCase
            ? `Your request about ${selectedCase.title} is in the support queue.`
            : "Your request is in the support queue."
        }
      });

      await tx.auditLog.create({
        data: {
          userId: ownerId,
          ...(selectedCase ? { caseId: selectedCase.id } : {}),
          action: "support.request_created",
          metadata: {
            requestId: createdRequest.id,
            category: input.category,
            priority: input.priority,
            subject
          }
        }
      });

      return createdRequest;
    });

    return toSupportRequestRecord(request);
  }

  async getRequest(ownerId: string, requestId: string): Promise<SupportRequestDetailRecord> {
    const request = await this.prisma.supportRequest.findFirst({
      where: {
        id: requestId,
        userId: ownerId
      },
      select: supportRequestDetailSelect
    });

    if (!request) {
      throw new NotFoundException("Support request not found.");
    }

    return toSupportRequestDetailRecord(request);
  }

  async addRequestMessage(
    ownerId: string,
    requestId: string,
    input: CreateSupportRequestMessageDto
  ): Promise<SupportRequestMessageRecord> {
    const message = input.message.trim();

    if (message.length < 2 || message.length > 5000) {
      throw new BadRequestException("Support follow-up message must be 2 to 5000 characters.");
    }

    const request = await this.prisma.supportRequest.findFirst({
      where: {
        id: requestId,
        userId: ownerId
      },
      select: {
        id: true,
        caseId: true,
        status: true,
        subject: true
      }
    });

    if (!request) {
      throw new NotFoundException("Support request not found.");
    }

    if (request.status === "RESOLVED") {
      throw new BadRequestException("Resolved support requests cannot receive follow-ups.");
    }

    const createdMessage = await this.prisma.$transaction(async (tx) => {
      const nextMessage = await tx.supportRequestMessage.create({
        data: {
          requestId: request.id,
          author: "USER",
          message
        },
        select: supportRequestMessageSelect
      });

      await tx.supportRequest.update({
        where: { id: request.id },
        data: { readAt: new Date(), updatedAt: new Date() }
      });

      await tx.notification.create({
        data: {
          userId: ownerId,
          ...(request.caseId ? { caseId: request.caseId } : {}),
          type: `support.request_updated:${request.id}`,
          title: "Support follow-up received",
          body: `Your follow-up for ${request.subject} was added to the request.`
        }
      });

      await tx.auditLog.create({
        data: {
          userId: ownerId,
          ...(request.caseId ? { caseId: request.caseId } : {}),
          action: "support.request_message_added",
          metadata: {
            requestId: request.id
          }
        }
      });

      return nextMessage;
    });

    return toSupportRequestMessageRecord(createdMessage);
  }

  async recordArticleFeedback(ownerId: string, input: RecordArticleFeedbackDto) {
    if (!validArticleSlugs.has(input.articleSlug)) {
      throw new BadRequestException("Help article not found.");
    }

    await this.prisma.auditLog.create({
      data: {
        userId: ownerId,
        action: "help.article_feedback_recorded",
        metadata: {
          articleSlug: input.articleSlug,
          helpful: input.helpful
        }
      }
    });

    return { recorded: true };
  }
}

function toSupportRequestRecord(request: SupportRequestRow): SupportRequestRecord {
  return {
    ...request,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString()
  };
}

function toSupportRequestDetailRecord(
  request: SupportRequestDetailRow
): SupportRequestDetailRecord {
  return {
    ...toSupportRequestRecord(request),
    messages: request.messages.map(toSupportRequestMessageRecord)
  };
}

function toSupportRequestMessageRecord(
  message: SupportRequestMessageRow
): SupportRequestMessageRecord {
  return {
    ...message,
    createdAt: message.createdAt.toISOString()
  };
}
