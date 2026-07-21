import { Injectable, NotFoundException } from "@nestjs/common";
import {
  AssistantMessageRole,
  AssistantResponseMode
} from "@proofpilot/database";
import type {
  AssistantExchange,
  AssistantMessage,
  AssistantWorkspace
} from "@proofpilot/types";
import { buildCaseAccessWhere } from "../common/case-access.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  assistantCaseSelect,
  getAssistantNextActions,
  getAssistantSuggestedPrompts,
  toAssistantCaseSummary,
  type AssistantCaseContext
} from "./assistant-case-context.js";
import { createGuidedAssistantResponse } from "./assistant-guided-response.js";
import type { CreateAssistantMessageDto } from "./dto/create-assistant-message.dto.js";

const assistantMessageSelect = {
  id: true,
  role: true,
  content: true,
  responseMode: true,
  model: true,
  createdAt: true
} as const;

@Injectable()
export class AssistantService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkspace(userId: string, caseId: string): Promise<AssistantWorkspace> {
    const caseRecord = await this.getAccessibleCase(userId, caseId);
    const thread = await this.prisma.assistantThread.findUnique({
      where: {
        userId_caseId: { userId, caseId }
      },
      select: {
        id: true,
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 50,
          select: assistantMessageSelect
        }
      }
    });

    return {
      capability: getGuidedCapability(),
      case: toAssistantCaseSummary(caseRecord),
      messages: thread ? [...thread.messages].reverse().map(toAssistantMessage) : [],
      nextActions: getAssistantNextActions(caseRecord),
      suggestedPrompts: getAssistantSuggestedPrompts(caseRecord),
      threadId: thread?.id ?? null
    };
  }

  async createMessage(
    userId: string,
    caseId: string,
    input: CreateAssistantMessageDto
  ): Promise<AssistantExchange> {
    const caseRecord = await this.getAccessibleCase(userId, caseId);
    const content = input.content.trim();
    const response = createGuidedAssistantResponse(caseRecord, content);

    return this.prisma.$transaction(async (tx) => {
      const thread = await tx.assistantThread.upsert({
        where: {
          userId_caseId: { userId, caseId }
        },
        update: { title: caseRecord.title },
        create: {
          userId,
          caseId,
          title: caseRecord.title
        },
        select: { id: true }
      });
      const userMessage = await tx.assistantMessage.create({
        data: {
          threadId: thread.id,
          role: AssistantMessageRole.USER,
          content
        },
        select: assistantMessageSelect
      });
      const assistantMessage = await tx.assistantMessage.create({
        data: {
          threadId: thread.id,
          role: AssistantMessageRole.ASSISTANT,
          content: response.content,
          responseMode: AssistantResponseMode.GUIDED
        },
        select: assistantMessageSelect
      });

      await tx.auditLog.create({
        data: {
          userId,
          caseId,
          action: "assistant.guided_response_created",
          metadata: {
            assistantMessageId: assistantMessage.id,
            intent: response.intent,
            promptLength: content.length,
            responseMode: AssistantResponseMode.GUIDED,
            threadId: thread.id
          }
        }
      });

      return {
        assistantMessage: toAssistantMessage(assistantMessage),
        threadId: thread.id,
        userMessage: toAssistantMessage(userMessage)
      };
    });
  }

  private async getAccessibleCase(
    userId: string,
    caseId: string
  ): Promise<AssistantCaseContext> {
    const caseRecord = await this.prisma.case.findFirst({
      where: {
        archivedAt: null,
        id: caseId,
        ...buildCaseAccessWhere(userId, "READ")
      },
      select: assistantCaseSelect
    });

    if (!caseRecord) {
      throw new NotFoundException("Case not found.");
    }

    return caseRecord;
  }
}

function getGuidedCapability() {
  return {
    model: null,
    modelGeneration: false,
    responseMode: "GUIDED" as const
  };
}

function toAssistantMessage(message: {
  content: string;
  createdAt: Date;
  id: string;
  model: string | null;
  responseMode: AssistantResponseMode | null;
  role: AssistantMessageRole;
}): AssistantMessage {
  return {
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    id: message.id,
    model: message.model,
    responseMode: message.responseMode,
    role: message.role
  };
}
