import { Injectable, NotFoundException } from "@nestjs/common";
import { CaseStatus, ChecklistStatus, Prisma } from "@proofpilot/database";
import { PrismaService } from "../prisma/prisma.service.js";
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
            updatedAt: true
          }
        },
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
