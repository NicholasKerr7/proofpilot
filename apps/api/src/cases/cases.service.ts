import { Injectable, NotFoundException } from "@nestjs/common";
import { CaseStatus, ChecklistStatus, DocumentStatus, Prisma } from "@proofpilot/database";
import { PrismaService } from "../prisma/prisma.service.js";
import { analyzeChecklistEvidence } from "./case-checklist-analysis.js";
import { analyzeTimelineEvidence } from "./case-timeline-analysis.js";
import type { CreateCaseDto } from "./dto/create-case.dto.js";
import type { UpdateCaseDto } from "./dto/update-case.dto.js";

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

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
              checklist: true
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
            checklist: true
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
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 20
        },
        checklist: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            label: true,
            description: true,
            status: true,
            updatedAt: true,
            matches: {
              orderBy: { confidence: "desc" },
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
          }
        },
        events: this.getTimelineSelect(),
        _count: {
          select: {
            documents: true,
            events: true,
            checklist: true,
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

  async listTimeline(ownerId: string, caseId: string) {
    await this.assertCaseOwnership(ownerId, caseId);

    return this.prisma.caseEvent.findMany({
      where: { caseId },
      ...this.getTimelineSelect()
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
      select: {
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
      }
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
