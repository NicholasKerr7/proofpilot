import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import {
  analyzeCaseChecklist,
  analyzeCaseChecklistTransaction,
  CaseStatus,
  ChecklistStatus,
  DocumentStatus,
  PacketStatus,
  Prisma
} from "@proofpilot/database";
import { createPresignedDownloadUrl } from "@proofpilot/storage";
import type { CaseActivityResponse } from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";
import { PacketGenerationQueueService } from "../queue/packet-generation-queue.service.js";
import { getCaseActivityActionFilter, toCaseActivityItem } from "./case-activity.js";
import { generateAppealStatement } from "./case-statement-generation.js";
import { generateCaseSummary } from "./case-summary-generation.js";
import { analyzeTimelineEvidence } from "./case-timeline-analysis.js";
import type { CreateCaseDto } from "./dto/create-case.dto.js";
import type { CreateTimelineEventDto } from "./dto/create-timeline-event.dto.js";
import type { ListCaseActivityQueryDto } from "./dto/list-case-activity-query.dto.js";
import type { ReorderTimelineEventsDto } from "./dto/reorder-timeline-events.dto.js";
import type { SaveStatementGuidanceDto } from "./dto/save-statement-guidance.dto.js";
import type { SaveStatementDto } from "./dto/save-statement.dto.js";
import type { UpdateCaseDto } from "./dto/update-case.dto.js";
import type { UpdateChecklistItemDto } from "./dto/update-checklist-item.dto.js";
import type { UpdateTimelineEventDto } from "./dto/update-timeline-event.dto.js";

interface PrivatePacketRecord {
  id: string;
  caseId: string;
  status: PacketStatus;
  createdAt: Date;
  updatedAt: Date;
  exports: {
    id: string;
    storageKey: string;
    byteSize: number | null;
    createdAt: Date;
  }[];
}

interface PrivateStatementGuidanceRecord {
  id: string;
  caseId: string;
  platformAction: string | null;
  actionDate: string | null;
  reasonGiven: string | null;
  accountUse: string | null;
  supportContact: string | null;
  requestedOutcome: string | null;
  supportingDocuments: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type StatementAuditAction =
  | "case.statement_generated"
  | "case.statement_restored"
  | "case.statement_saved";

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly packetGenerationQueue: PacketGenerationQueueService
  ) {}

  async create(ownerId: string, input: CreateCaseDto) {
    const [caseType, preference] = await Promise.all([
      this.prisma.caseType.findUnique({
        where: { slug: input.caseTypeSlug ?? "account-ban-appeal" }
      }),
      this.prisma.userPreference.findUnique({
        where: { userId: ownerId },
        select: { defaultCaseStatus: true }
      })
    ]);

    if (!caseType) {
      throw new NotFoundException("Case type not found.");
    }

    const defaultCaseStatus =
      preference?.defaultCaseStatus === CaseStatus.COLLECTING_EVIDENCE
        ? CaseStatus.COLLECTING_EVIDENCE
        : CaseStatus.DRAFT;

    return this.prisma.$transaction(async (tx) => {
      const createdCase = await tx.case.create({
        data: {
          ownerId,
          caseTypeId: caseType.id,
          title: input.title,
          platform: input.platform,
          status: defaultCaseStatus,
          ...(input.summary ? { summary: input.summary } : {}),
          ...(input.deadline ? { deadline: new Date(input.deadline) } : {})
        }
      });

      const template = await tx.caseTemplate.findFirst({
        where: { caseTypeId: caseType.id },
        include: {
          requirements: {
            orderBy: { sortOrder: "asc" }
          }
        }
      });

      if (template?.requirements.length) {
        await tx.caseChecklistItem.createMany({
          data: template.requirements.map((requirement) => ({
            caseId: createdCase.id,
            requirementId: requirement.id,
            label: requirement.label,
            description: requirement.description,
            status: requirement.required ? ChecklistStatus.MISSING : ChecklistStatus.OPTIONAL
          }))
        });
      }

      await tx.auditLog.create({
        data: {
          userId: ownerId,
          caseId: createdCase.id,
          action: "case.created",
          metadata: {
            title: createdCase.title,
            platform: createdCase.platform,
            status: createdCase.status,
            checklistItemsCreated: template?.requirements.length ?? 0
          }
        }
      });

      return tx.case.findUniqueOrThrow({
        where: { id: createdCase.id },
        include: {
          caseType: true,
          _count: {
            select: {
              documents: true,
              events: true,
              checklist: true,
              statements: true
            }
          }
        }
      });
    });
  }

  list(ownerId: string) {
    return this.prisma.case.findMany({
      where: {
        ownerId,
        archivedAt: null
      },
      orderBy: { updatedAt: "desc" },
      include: {
        caseType: true,
        _count: {
          select: {
            documents: true,
            events: true,
            checklist: true,
            statements: true
          }
        }
      }
    });
  }

  async get(ownerId: string, caseId: string) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ownerId,
        archivedAt: null
      },
      include: {
        caseType: true,
        checklist: this.getChecklistSelect(),
        events: this.getTimelineSelect(),
        _count: {
          select: {
            documents: true,
            events: true,
            checklist: true,
            statements: true,
            packets: true
          }
        }
      }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    return foundCase;
  }

  async listActivity(
    ownerId: string,
    caseId: string,
    query: ListCaseActivityQueryDto
  ): Promise<CaseActivityResponse> {
    await this.assertCaseOwnership(ownerId, caseId);

    const actionFilter = getCaseActivityActionFilter(query.category);
    const where: Prisma.AuditLogWhereInput = {
      caseId,
      ...(actionFilter ? { action: actionFilter } : {})
    };
    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: query.offset,
        take: query.limit,
        select: {
          id: true,
          action: true,
          metadata: true,
          createdAt: true
        }
      }),
      this.prisma.auditLog.count({ where })
    ]);
    const items = logs.map(toCaseActivityItem);

    return {
      items,
      total,
      hasMore: query.offset + items.length < total
    };
  }

  async listTimeline(ownerId: string, caseId: string) {
    await this.assertCaseOwnership(ownerId, caseId);

    return this.prisma.caseEvent.findMany({
      where: { caseId },
      ...this.getTimelineSelect()
    });
  }

  async createTimelineEvent(ownerId: string, caseId: string, input: CreateTimelineEventDto) {
    await this.assertCaseOwnership(ownerId, caseId);

    const title = input.title.trim();
    const description = input.description?.trim();
    const documentIds = input.documentIds ?? [];
    const occurredAt = new Date(input.occurredAt);

    if (!title) {
      throw new BadRequestException("Timeline event title is required.");
    }

    await this.assertTimelineDocumentOwnership(ownerId, caseId, documentIds);

    return this.prisma.$transaction(async (tx) => {
      const nextChronologicalEvent = await tx.caseEvent.findFirst({
        where: {
          caseId,
          occurredAt: { gt: occurredAt }
        },
        orderBy: [{ sortOrder: "asc" }, { occurredAt: "asc" }, { id: "asc" }],
        select: { sortOrder: true }
      });
      const latestOrder = nextChronologicalEvent
        ? null
        : await tx.caseEvent.aggregate({
            where: { caseId },
            _max: { sortOrder: true }
          });
      const sortOrder = nextChronologicalEvent?.sortOrder ?? (latestOrder?._max.sortOrder ?? -1) + 1;

      if (nextChronologicalEvent) {
        await tx.caseEvent.updateMany({
          where: {
            caseId,
            sortOrder: { gte: sortOrder }
          },
          data: {
            sortOrder: { increment: 1 }
          }
        });
      }

      const event = await tx.caseEvent.create({
        data: {
          caseId,
          sortOrder,
          occurredAt,
          title,
          ...(description ? { description } : {}),
          confidence: null,
          ...(documentIds.length
            ? {
                sources: {
                  create: documentIds.map((documentId) => ({ documentId }))
                }
              }
            : {})
        },
        select: this.getTimelineEventSelect()
      });

      await tx.auditLog.create({
        data: {
          userId: ownerId,
          caseId,
          action: "case.timeline_event_created",
          metadata: {
            eventId: event.id,
            occurredAt: event.occurredAt.toISOString(),
            sourceCount: documentIds.length,
            title
          }
        }
      });

      return event;
    });
  }

  async updateTimelineEvent(
    ownerId: string,
    caseId: string,
    eventId: string,
    input: UpdateTimelineEventDto
  ) {
    const existingEvent = await this.prisma.caseEvent.findFirst({
      where: {
        id: eventId,
        caseId,
        case: {
          ownerId,
          archivedAt: null
        }
      },
      select: {
        id: true,
        title: true
      }
    });

    if (!existingEvent) {
      throw new NotFoundException("Timeline event not found.");
    }

    const updatedFields = [
      input.occurredAt !== undefined ? "occurredAt" : null,
      input.title !== undefined ? "title" : null,
      input.description !== undefined ? "description" : null,
      input.documentIds !== undefined ? "sources" : null
    ].filter((field): field is string => field !== null);

    if (!updatedFields.length) {
      throw new BadRequestException("Add at least one timeline event change.");
    }

    const title = input.title?.trim();
    const description = input.description?.trim() || null;
    const documentIds = input.documentIds ?? [];

    if (input.title !== undefined && !title) {
      throw new BadRequestException("Timeline event title is required.");
    }

    if (input.documentIds !== undefined) {
      await this.assertTimelineDocumentOwnership(ownerId, caseId, documentIds);
    }

    return this.prisma.$transaction(async (tx) => {
      if (
        input.occurredAt !== undefined ||
        input.title !== undefined ||
        input.description !== undefined
      ) {
        const eventUpdate: Prisma.CaseEventUncheckedUpdateInput = {};

        if (input.occurredAt !== undefined) {
          eventUpdate.occurredAt = new Date(input.occurredAt);
        }

        if (input.title !== undefined) {
          eventUpdate.title = input.title.trim();
        }

        if (input.description !== undefined) {
          eventUpdate.description = description;
        }

        await tx.caseEvent.update({
          where: { id: eventId },
          data: eventUpdate
        });
      }

      if (input.documentIds !== undefined) {
        await tx.eventSource.deleteMany({ where: { eventId } });

        if (documentIds.length) {
          await tx.eventSource.createMany({
            data: documentIds.map((documentId) => ({
              eventId,
              documentId
            }))
          });
        }
      }

      const event = await tx.caseEvent.findUniqueOrThrow({
        where: { id: eventId },
        select: this.getTimelineEventSelect()
      });

      await tx.auditLog.create({
        data: {
          userId: ownerId,
          caseId,
          action: "case.timeline_event_updated",
          metadata: {
            eventId,
            title: event.title,
            updatedFields
          }
        }
      });

      return event;
    });
  }

  async deleteTimelineEvent(ownerId: string, caseId: string, eventId: string) {
    const existingEvent = await this.prisma.caseEvent.findFirst({
      where: {
        id: eventId,
        caseId,
        case: {
          ownerId,
          archivedAt: null
        }
      },
      select: {
        id: true,
        title: true
      }
    });

    if (!existingEvent) {
      throw new NotFoundException("Timeline event not found.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.caseEvent.delete({ where: { id: eventId } });
      await tx.auditLog.create({
        data: {
          userId: ownerId,
          caseId,
          action: "case.timeline_event_deleted",
          metadata: {
            eventId,
            title: existingEvent.title
          }
        }
      });
    });

    return { id: eventId };
  }

  async reorderTimeline(ownerId: string, caseId: string, input: ReorderTimelineEventsDto) {
    await this.assertCaseOwnership(ownerId, caseId);

    const events = await this.prisma.caseEvent.findMany({
      where: { caseId },
      select: { id: true }
    });
    const ownedEventIds = new Set(events.map((event) => event.id));

    if (
      new Set(input.eventIds).size !== input.eventIds.length ||
      input.eventIds.length !== events.length ||
      input.eventIds.some((eventId) => !ownedEventIds.has(eventId))
    ) {
      throw new BadRequestException("Timeline order must include every event in this case once.");
    }

    return this.prisma.$transaction(async (tx) => {
      for (const [sortOrder, eventId] of input.eventIds.entries()) {
        await tx.caseEvent.update({
          where: { id: eventId },
          data: { sortOrder }
        });
      }

      await tx.auditLog.create({
        data: {
          userId: ownerId,
          caseId,
          action: "case.timeline_reordered",
          metadata: {
            eventCount: input.eventIds.length
          }
        }
      });

      return tx.caseEvent.findMany({
        where: { caseId },
        ...this.getTimelineSelect()
      });
    });
  }

  async analyzeTimeline(ownerId: string, caseId: string) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ownerId,
        archivedAt: null
      },
      select: {
        id: true,
        documents: {
          where: {
            status: DocumentStatus.PROCESSED,
            extractedText: {
              not: null
            }
          },
          select: {
            id: true,
            originalName: true,
            extractedText: true,
            entities: {
              select: {
                type: true,
                value: true
              }
            }
          }
        }
      }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    const analyzedEvents = analyzeTimelineEvidence(foundCase.documents);

    await this.prisma.$transaction(async (tx) => {
      await tx.caseEvent.deleteMany({
        where: {
          caseId: foundCase.id,
          confidence: { not: null }
        }
      });

      for (const event of analyzedEvents) {
        await tx.caseEvent.create({
          data: {
            caseId: foundCase.id,
            sortOrder: 0,
            occurredAt: event.occurredAt,
            title: event.title,
            description: event.description,
            confidence: event.confidence,
            sources: {
              create: {
                documentId: event.documentId
              }
            }
          }
        });
      }

      const chronologicalEvents = await tx.caseEvent.findMany({
        where: { caseId: foundCase.id },
        orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: { id: true }
      });

      for (const [sortOrder, event] of chronologicalEvents.entries()) {
        await tx.caseEvent.update({
          where: { id: event.id },
          data: { sortOrder }
        });
      }

      await tx.auditLog.create({
        data: {
          userId: ownerId,
          caseId: foundCase.id,
          action: "case.timeline_analyzed",
          metadata: {
            documentsAnalyzed: foundCase.documents.length,
            eventCount: analyzedEvents.length
          }
        }
      });
    });

    return this.get(ownerId, caseId);
  }

  async listChecklist(ownerId: string, caseId: string) {
    await this.assertCaseOwnership(ownerId, caseId);

    return this.prisma.caseChecklistItem.findMany({
      where: { caseId },
      ...this.getChecklistSelect()
    });
  }

  async analyzeChecklist(ownerId: string, caseId: string) {
    const analysis = await analyzeCaseChecklist(this.prisma, {
      caseId,
      ownerId
    });

    if (!analysis) {
      throw new NotFoundException("Case not found.");
    }

    return this.get(ownerId, caseId);
  }

  async updateChecklistItem(
    ownerId: string,
    caseId: string,
    itemId: string,
    input: UpdateChecklistItemDto
  ) {
    await this.prisma.$transaction(async (tx) => {
      const checklistItem = await tx.caseChecklistItem.findFirst({
        where: {
          id: itemId,
          caseId,
          case: {
            ownerId,
            archivedAt: null
          }
        },
        select: {
          id: true,
          label: true,
          requirement: {
            select: { required: true }
          }
        }
      });

      if (!checklistItem) {
        throw new NotFoundException("Checklist item not found.");
      }

      const fallbackStatus =
        checklistItem.requirement?.required === false
          ? ChecklistStatus.OPTIONAL
          : ChecklistStatus.MISSING;
      const manuallyCompletedAt = input.completed ? new Date() : null;

      await tx.caseChecklistItem.update({
        where: { id: checklistItem.id },
        data: {
          manuallyCompletedAt,
          status: input.completed ? ChecklistStatus.COMPLETE : fallbackStatus
        }
      });
      await tx.auditLog.create({
        data: {
          userId: ownerId,
          caseId,
          action: input.completed
            ? "case.checklist_item_completed"
            : "case.checklist_item_reopened",
          metadata: {
            checklistItemId: checklistItem.id,
            label: checklistItem.label
          }
        }
      });

      const analysis = await analyzeCaseChecklistTransaction(tx, {
        auditAction: null,
        caseId,
        ownerId
      });

      if (!analysis) {
        throw new NotFoundException("Case not found.");
      }
    });

    return this.get(ownerId, caseId);
  }

  async getStatement(ownerId: string, caseId: string) {
    await this.assertCaseOwnership(ownerId, caseId);

    const [statement, guidance, summaryHistory] = await Promise.all([
      this.prisma.caseStatement.findFirst({
        where: { caseId },
        orderBy: { updatedAt: "desc" },
        select: this.getStatementSelect()
      }),
      this.prisma.statementGuidance.findUnique({
        where: { caseId },
        select: this.getStatementGuidanceSelect()
      }),
      this.prisma.caseSummary.findMany({
        where: { caseId },
        orderBy: { createdAt: "desc" },
        select: this.getCaseSummarySelect(),
        take: 5
      })
    ]);

    return {
      statement,
      guidance: this.toPublicStatementGuidance(guidance),
      summary: summaryHistory[0] ?? null,
      summaryHistory
    };
  }

  async saveStatement(ownerId: string, caseId: string, input: SaveStatementDto) {
    await this.assertCaseOwnership(ownerId, caseId);
    return this.upsertStatementDraft(ownerId, caseId, input.content, "case.statement_saved");
  }

  async saveStatementGuidance(
    ownerId: string,
    caseId: string,
    input: SaveStatementGuidanceDto
  ) {
    await this.assertCaseOwnership(ownerId, caseId);
    const data = this.normalizeStatementGuidance(input);

    const guidance = await this.prisma.$transaction(async (tx) => {
      const savedGuidance = await tx.statementGuidance.upsert({
        where: { caseId },
        update: data,
        create: {
          caseId,
          ...data
        },
        select: this.getStatementGuidanceSelect()
      });

      await tx.auditLog.create({
        data: {
          userId: ownerId,
          caseId,
          action: "case.statement_guidance_saved",
          metadata: {
            answeredCount: Object.values(data).filter(Boolean).length,
            guidanceId: savedGuidance.id
          }
        }
      });

      return savedGuidance;
    });

    return this.toPublicStatementGuidance(guidance);
  }

  async generateStatement(ownerId: string, caseId: string) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ownerId,
        archivedAt: null
      },
      select: {
        id: true,
        title: true,
        platform: true,
        summary: true,
        deadline: true,
        checklist: {
          orderBy: { createdAt: "asc" },
          select: {
            label: true,
            status: true
          }
        },
        documents: {
          orderBy: { createdAt: "desc" },
          select: {
            originalName: true,
            status: true
          }
        },
        events: {
          orderBy: [{ sortOrder: "asc" }, { occurredAt: "asc" }, { id: "asc" }],
          select: {
            occurredAt: true,
            title: true,
            description: true
          }
        },
        statementGuidance: {
          select: {
            platformAction: true,
            actionDate: true,
            reasonGiven: true,
            accountUse: true,
            supportContact: true,
            requestedOutcome: true,
            supportingDocuments: true
          }
        }
      }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    const content = generateAppealStatement({
      ...foundCase,
      guidance: foundCase.statementGuidance
    });
    return this.upsertStatementDraft(ownerId, caseId, content, "case.statement_generated");
  }

  async restoreStatementVersion(ownerId: string, caseId: string, versionId: string) {
    const version = await this.prisma.statementVersion.findFirst({
      where: {
        id: versionId,
        statement: {
          caseId,
          case: {
            ownerId,
            archivedAt: null
          }
        }
      },
      select: {
        content: true,
        version: true
      }
    });

    if (!version) {
      throw new NotFoundException("Statement version not found.");
    }

    return this.upsertStatementDraft(
      ownerId,
      caseId,
      version.content,
      "case.statement_restored",
      { restoredFromVersion: version.version }
    );
  }

  async generateSummary(ownerId: string, caseId: string) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ownerId,
        archivedAt: null
      },
      select: {
        id: true,
        title: true,
        platform: true,
        documents: {
          orderBy: { createdAt: "asc" },
          select: {
            originalName: true,
            status: true
          }
        },
        events: {
          orderBy: [{ sortOrder: "asc" }, { occurredAt: "asc" }, { id: "asc" }],
          select: {
            occurredAt: true,
            title: true
          }
        },
        checklist: {
          orderBy: { createdAt: "asc" },
          select: {
            label: true,
            status: true,
            requirement: {
              select: { required: true }
            }
          }
        },
        statements: {
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: { content: true }
        },
        statementGuidance: {
          select: { requestedOutcome: true }
        }
      }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    const content = generateCaseSummary({
      ...foundCase,
      statement: foundCase.statements[0]?.content ?? null,
      requestedOutcome: foundCase.statementGuidance?.requestedOutcome ?? null
    });

    return this.prisma.$transaction(async (tx) => {
      const summary = await tx.caseSummary.create({
        data: {
          caseId,
          content
        },
        select: this.getCaseSummarySelect()
      });

      await tx.case.update({
        where: { id: caseId },
        data: { summary: content }
      });
      await tx.auditLog.create({
        data: {
          userId: ownerId,
          caseId,
          action: "case.statement_summary_generated",
          metadata: {
            documentCount: foundCase.documents.length,
            eventCount: foundCase.events.length,
            summaryId: summary.id
          }
        }
      });

      return summary;
    });
  }

  async listPackets(ownerId: string, caseId: string) {
    await this.assertCaseOwnership(ownerId, caseId);

    const packets = await this.prisma.casePacket.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
      select: this.getPacketSelect()
    });

    return Promise.all(packets.map((packet) => this.toPublicPacket(packet)));
  }

  async generatePacket(ownerId: string, caseId: string) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ownerId,
        archivedAt: null
      },
      select: {
        id: true
      }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    const existingPacket = await this.prisma.casePacket.findFirst({
      where: {
        caseId: foundCase.id,
        status: PacketStatus.GENERATING
      },
      orderBy: { createdAt: "desc" },
      select: this.getPacketSelect()
    });

    if (existingPacket) {
      return this.toPublicPacket(existingPacket);
    }

    const packet = await this.prisma.casePacket.create({
      data: {
        caseId: foundCase.id,
        status: PacketStatus.GENERATING
      },
      select: this.getPacketSelect()
    });

    let jobId: string | null = null;

    try {
      const job = await this.packetGenerationQueue.addGeneratePacketJob({
        caseId: foundCase.id,
        ownerId,
        packetId: packet.id
      });
      jobId = job.id ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Packet generation could not be queued.";

      await this.prisma.$transaction([
        this.prisma.casePacket.update({
          where: { id: packet.id },
          data: { status: PacketStatus.FAILED }
        }),
        this.prisma.auditLog.create({
          data: {
            userId: ownerId,
            caseId: foundCase.id,
            action: "case.packet_generation_queue_failed",
            metadata: {
              message,
              packetId: packet.id
            }
          }
        })
      ]);

      throw new ServiceUnavailableException("Packet generation could not be queued. Try again shortly.");
    }

    await this.prisma.auditLog.create({
      data: {
        userId: ownerId,
        caseId: foundCase.id,
        action: "case.packet_generation_queued",
        metadata: {
          jobId,
          packetId: packet.id
        }
      }
    });

    return this.toPublicPacket(packet);
  }

  async update(ownerId: string, caseId: string, input: UpdateCaseDto) {
    await this.assertCaseOwnership(ownerId, caseId);
    const data: Prisma.CaseUpdateInput = {};

    if (input.title !== undefined) {
      data.title = input.title;
    }

    if (input.platform !== undefined) {
      data.platform = input.platform;
    }

    if (input.summary !== undefined) {
      data.summary = input.summary;
    }

    if (input.status !== undefined) {
      data.status = input.status;
    }

    if (input.deadline !== undefined) {
      data.deadline = input.deadline ? new Date(input.deadline) : null;
    }

    const updatedCase = await this.prisma.case.update({
      where: { id: caseId },
      data,
      include: {
        caseType: true
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: ownerId,
        caseId,
        action: "case.updated",
        metadata: this.toUpdateAuditMetadata(input)
      }
    });

    return updatedCase;
  }

  async archive(ownerId: string, caseId: string) {
    await this.assertCaseOwnership(ownerId, caseId);

    const archivedCase = await this.prisma.case.update({
      where: { id: caseId },
      data: {
        archivedAt: new Date(),
        status: CaseStatus.ARCHIVED
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: ownerId,
        caseId,
        action: "case.archived",
        metadata: { title: archivedCase.title }
      }
    });

    return { id: caseId, archived: true };
  }

  private async assertCaseOwnership(ownerId: string, caseId: string) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ownerId,
        archivedAt: null
      },
      select: { id: true }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }
  }

  private async assertTimelineDocumentOwnership(
    ownerId: string,
    caseId: string,
    documentIds: string[]
  ) {
    if (!documentIds.length) {
      return;
    }

    const documents = await this.prisma.document.findMany({
      where: {
        id: { in: documentIds },
        caseId,
        case: {
          ownerId,
          archivedAt: null
        }
      },
      select: { id: true }
    });

    if (documents.length !== documentIds.length) {
      throw new BadRequestException("Every timeline source must belong to this case.");
    }
  }

  private getTimelineSelect() {
    return {
      orderBy: [
        { sortOrder: "asc" as const },
        { occurredAt: "asc" as const },
        { id: "asc" as const }
      ],
      select: this.getTimelineEventSelect()
    };
  }

  private getTimelineEventSelect() {
    return {
      id: true,
      sortOrder: true,
      occurredAt: true,
      title: true,
      description: true,
      confidence: true,
      createdAt: true,
      updatedAt: true,
      sources: {
        select: {
          id: true,
          document: {
            select: {
              id: true,
              originalName: true
            }
          }
        }
      }
    };
  }

  private getChecklistSelect() {
    return {
      orderBy: { createdAt: "asc" as const },
      select: this.getChecklistItemSelect()
    };
  }

  private getChecklistItemSelect() {
    return {
      id: true,
      label: true,
      description: true,
      status: true,
      manuallyCompletedAt: true,
      updatedAt: true,
      matches: {
        orderBy: { confidence: "desc" as const },
        take: 3,
        select: {
          id: true,
          confidence: true,
          rationale: true,
          document: {
            select: {
              id: true,
              originalName: true
            }
          }
        }
      }
    };
  }

  private getStatementSelect() {
    return {
      id: true,
      caseId: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      versions: {
        orderBy: { version: "desc" as const },
        select: {
          id: true,
          content: true,
          version: true,
          createdAt: true
        },
        take: 10
      }
    };
  }

  private getStatementGuidanceSelect() {
    return {
      id: true,
      caseId: true,
      platformAction: true,
      actionDate: true,
      reasonGiven: true,
      accountUse: true,
      supportContact: true,
      requestedOutcome: true,
      supportingDocuments: true,
      createdAt: true,
      updatedAt: true
    };
  }

  private getCaseSummarySelect() {
    return {
      id: true,
      caseId: true,
      content: true,
      createdAt: true,
      updatedAt: true
    };
  }

  private getPacketSelect() {
    return {
      id: true,
      caseId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      exports: {
        orderBy: { createdAt: "desc" as const },
        select: {
          id: true,
          storageKey: true,
          byteSize: true,
          createdAt: true
        }
      }
    };
  }

  private async toPublicPacket(packet: PrivatePacketRecord) {
    return {
      id: packet.id,
      caseId: packet.caseId,
      status: packet.status,
      createdAt: packet.createdAt,
      updatedAt: packet.updatedAt,
      exports: await Promise.all(
        packet.exports.map(async (packetExport) => ({
          id: packetExport.id,
          byteSize: packetExport.byteSize,
          createdAt: packetExport.createdAt,
          downloadUrl: await createPresignedDownloadUrl({
            expiresInSeconds: 900,
            key: packetExport.storageKey
          })
        }))
      )
    };
  }

  private async upsertStatementDraft(
    ownerId: string,
    caseId: string,
    rawContent: string,
    action: StatementAuditAction,
    auditMetadata: Record<string, number> = {}
  ) {
    const content = rawContent.trim();

    if (!content) {
      throw new BadRequestException("Statement content is required.");
    }

    if (content.length > 12000) {
      throw new BadRequestException("Statement content must be 12,000 characters or fewer.");
    }

    return this.prisma.$transaction(async (tx) => {
      const existingStatement = await tx.caseStatement.findFirst({
        where: { caseId },
        orderBy: { updatedAt: "desc" },
        select: { id: true }
      });

      const statement = existingStatement
        ? await this.updateStatementWithVersion(tx, existingStatement.id, content)
        : await tx.caseStatement.create({
            data: {
              caseId,
              content,
              versions: {
                create: {
                  content,
                  version: 1
                }
              }
            },
            select: this.getStatementSelect()
          });

      await tx.auditLog.create({
        data: {
          userId: ownerId,
          caseId,
          action,
          metadata: {
            statementId: statement.id,
            version: statement.versions[0]?.version ?? 1,
            ...auditMetadata
          }
        }
      });

      return statement;
    });
  }

  private async updateStatementWithVersion(
    tx: Prisma.TransactionClient,
    statementId: string,
    content: string
  ) {
    const latestVersion = await tx.statementVersion.aggregate({
      where: { statementId },
      _max: { version: true }
    });

    return tx.caseStatement.update({
      where: { id: statementId },
      data: {
        content,
        versions: {
          create: {
            content,
            version: (latestVersion._max.version ?? 0) + 1
          }
        }
      },
      select: this.getStatementSelect()
    });
  }

  private normalizeStatementGuidance(input: SaveStatementGuidanceDto) {
    return {
      platformAction: input.platformAction.trim() || null,
      actionDate: input.actionDate.trim() || null,
      reasonGiven: input.reasonGiven.trim() || null,
      accountUse: input.accountUse.trim() || null,
      supportContact: input.supportContact.trim() || null,
      requestedOutcome: input.requestedOutcome.trim() || null,
      supportingDocuments: input.supportingDocuments.trim() || null
    };
  }

  private toPublicStatementGuidance(guidance: PrivateStatementGuidanceRecord | null) {
    if (!guidance) {
      return null;
    }

    return {
      ...guidance,
      platformAction: guidance.platformAction ?? "",
      actionDate: guidance.actionDate ?? "",
      reasonGiven: guidance.reasonGiven ?? "",
      accountUse: guidance.accountUse ?? "",
      supportContact: guidance.supportContact ?? "",
      requestedOutcome: guidance.requestedOutcome ?? "",
      supportingDocuments: guidance.supportingDocuments ?? ""
    };
  }

  private toUpdateAuditMetadata(input: UpdateCaseDto) {
    const metadata: Record<string, string | null> = {};

    if (input.title !== undefined) {
      metadata.title = input.title;
    }

    if (input.platform !== undefined) {
      metadata.platform = input.platform;
    }

    if (input.summary !== undefined) {
      metadata.summary = input.summary;
    }

    if (input.status !== undefined) {
      metadata.status = input.status;
    }

    if (input.deadline !== undefined) {
      metadata.deadline = input.deadline;
    }

    return metadata;
  }
}
