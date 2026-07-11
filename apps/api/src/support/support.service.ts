import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@proofpilot/database";
import {
  helpArticleSlugs,
  type HelpArticleSlug,
  type SupportRequestRecord
} from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";
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

const validArticleSlugs = new Set<HelpArticleSlug>(helpArticleSlugs);

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async listRequests(ownerId: string): Promise<SupportRequestRecord[]> {
    const requests = await this.prisma.supportRequest.findMany({
      where: { userId: ownerId },
      orderBy: { createdAt: "desc" },
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
          priority: input.priority
        },
        select: supportRequestSelect
      });

      await tx.notification.create({
        data: {
          userId: ownerId,
          ...(selectedCase ? { caseId: selectedCase.id } : {}),
          type: "support.request_received",
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
