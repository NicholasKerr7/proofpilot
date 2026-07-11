import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { CaseStatus, ChecklistStatus, DocumentStatus, PacketStatus, Prisma } from "@proofpilot/database";
import { createPresignedDownloadUrl } from "@proofpilot/storage";
import type { CaseActivityResponse } from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";
import { PacketGenerationQueueService } from "../queue/packet-generation-queue.service.js";
import { analyzeChecklistEvidence } from "./case-checklist-analysis.js";
import { getCaseActivityActionFilter, toCaseActivityItem } from "./case-activity.js";
import { generateAppealStatement } from "./case-statement-generation.js";
import { analyzeTimelineEvidence } from "./case-timeline-analysis.js";
import type { CreateCaseDto } from "./dto/create-case.dto.js";
import type { CreateTimelineEventDto } from "./dto/create-timeline-event.dto.js";
import type { ListCaseActivityQueryDto } from "./dto/list-case-activity-query.dto.js";
import type { SaveStatementDto } from "./dto/save-statement.dto.js";
import type { UpdateCaseDto } from "./dto/update-case.dto.js";

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

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly packetGenerationQueue: PacketGenerationQueueService
  ) {}

  async create(ownerId: string, input: CreateCaseDto) {
    const caseType = await this.prisma.caseType.findUnique({
      where: { slug: input.caseTypeSlug ?? "account-ban-appeal" }
    });

    if (!caseType) {
      throw new NotFoundException("Case type not found.");
    }

    return this.prisma.$transaction(async (tx) => {
      const createdCase = await tx.case.create({
        data: {
          ownerId,
          caseTypeId: caseType.id,
          title: input.title,
          platform: input.platform,
          status: CaseStatus.COLLECTING_EVIDENCE,
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

    if (!title) {
      throw new BadRequestException("Timeline event title is required.");
    }

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.caseEvent.create({
        data: {
          caseId,
          occurredAt: new Date(input.occurredAt),
          title,
          ...(description ? { description } : {}),
          confidence: null
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
            title
          }
        }
      });

      return event;
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

    const documentIds = foundCase.documents.map((document) => document.id);
    const analyzedEvents = analyzeTimelineEvidence(foundCase.documents);

    await this.prisma.$transaction(async (tx) => {
      if (documentIds.length) {
        await tx.caseEvent.deleteMany({
          where: {
            caseId: foundCase.id,
            sources: {
              some: {
                documentId: {
                  in: documentIds
                }
              }
            }
          }
        });
      }

      for (const event of analyzedEvents) {
        await tx.caseEvent.create({
          data: {
            caseId: foundCase.id,
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
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ownerId,
        archivedAt: null
      },
      select: {
        id: true,
        summary: true,
        status: true,
        checklist: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            label: true,
            description: true,
            requirementId: true,
            status: true
          }
        },
        documents: {
          where: {
            status: {
              in: [DocumentStatus.PROCESSED, DocumentStatus.NEEDS_REVIEW]
            }
          },
          select: {
            id: true,
            originalName: true,
            mimeType: true,
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

    const analysis = analyzeChecklistEvidence({
      caseSummary: foundCase.summary,
      checklist: foundCase.checklist,
      documents: foundCase.documents
    });
    const checklistItemIds = foundCase.checklist.map((item) => item.id);
    const matchData = analysis.flatMap((item) => {
      if (!item.match || !item.requirementId) {
        return [];
      }

      return [
        {
          checklistItemId: item.checklistItemId,
          confidence: item.match.confidence,
          documentId: item.match.documentId,
          rationale: item.match.rationale,
          requirementId: item.requirementId
        }
      ];
    });
    const foundCount = analysis.filter(
      (item) => item.status === ChecklistStatus.FOUND || item.status === ChecklistStatus.COMPLETE
    ).length;
    const missingCount = analysis.filter((item) => item.status === ChecklistStatus.MISSING).length;
    const nextCaseStatus = foundCase.checklist.length
      ? this.getAnalyzedCaseStatus(foundCase.status, missingCount)
      : foundCase.status;

    await this.prisma.$transaction(async (tx) => {
      if (checklistItemIds.length) {
        await tx.caseRequirementMatch.deleteMany({
          where: {
            checklistItemId: {
              in: checklistItemIds
            }
          }
        });
      }

      for (const item of analysis) {
        await tx.caseChecklistItem.update({
          where: { id: item.checklistItemId },
          data: { status: item.status }
        });
      }

      if (matchData.length) {
        await tx.caseRequirementMatch.createMany({
          data: matchData
        });
      }

      await tx.case.update({
        where: { id: foundCase.id },
        data: {
          status: nextCaseStatus
        }
      });

      await tx.auditLog.create({
        data: {
          userId: ownerId,
          caseId: foundCase.id,
          action: "case.checklist_analyzed",
          metadata: {
            documentsAnalyzed: foundCase.documents.length,
            foundCount,
            missingCount,
            matchCount: matchData.length
          }
        }
      });
    });

    return this.get(ownerId, caseId);
  }

  async getStatement(ownerId: string, caseId: string) {
    await this.assertCaseOwnership(ownerId, caseId);

    const statement = await this.prisma.caseStatement.findFirst({
      where: { caseId },
      orderBy: { updatedAt: "desc" },
      select: this.getStatementSelect()
    });

    return { statement };
  }

  async saveStatement(ownerId: string, caseId: string, input: SaveStatementDto) {
    await this.assertCaseOwnership(ownerId, caseId);
    return this.upsertStatementDraft(ownerId, caseId, input.content, "case.statement_saved");
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
          orderBy: { occurredAt: "asc" },
          select: {
            occurredAt: true,
            title: true,
            description: true
          }
        }
      }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    const content = generateAppealStatement(foundCase);
    return this.upsertStatementDraft(ownerId, caseId, content, "case.statement_generated");
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

  private getAnalyzedCaseStatus(currentStatus: CaseStatus, missingCount: number) {
    if (
      currentStatus !== CaseStatus.COLLECTING_EVIDENCE &&
      currentStatus !== CaseStatus.NEEDS_MORE_EVIDENCE &&
      currentStatus !== CaseStatus.READY_FOR_REVIEW
    ) {
      return currentStatus;
    }

    return missingCount === 0 ? CaseStatus.READY_FOR_REVIEW : CaseStatus.NEEDS_MORE_EVIDENCE;
  }

  private getTimelineSelect() {
    return {
      orderBy: { occurredAt: "asc" as const },
      select: this.getTimelineEventSelect()
    };
  }

  private getTimelineEventSelect() {
    return {
      id: true,
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
        take: 5
      }
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
    action: "case.statement_generated" | "case.statement_saved"
  ) {
    const content = rawContent.trim();

    if (!content) {
      throw new BadRequestException("Statement content is required.");
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
            version: statement.versions[0]?.version ?? 1
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
