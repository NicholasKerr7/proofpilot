import { NotFoundException } from "@nestjs/common";
import {
  CaseStatus,
  ChecklistStatus,
  DocumentStatus,
  Prisma
} from "@proofpilot/database";
import {
  buildNotificationDelivery,
  type CaseActivityResponse
} from "@proofpilot/types";
import {
  buildCaseAccessInclude,
  buildCaseAccessWhere,
  createCaseAccess
} from "../common/case-access.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { getCaseActivityActionFilter, toCaseActivityItem } from "./case-activity.js";
import type { CaseAccessGuard } from "./case-access.guard.js";
import { checklistQuery, timelineQuery } from "./case-selects.js";
import type { CreateCaseDto } from "./dto/create-case.dto.js";
import type { ListCaseActivityQueryDto } from "./dto/list-case-activity-query.dto.js";
import type { UpdateCaseDto } from "./dto/update-case.dto.js";

/** Owns case lifecycle queries, mutations, activity, and status notifications. */
export class CaseRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CaseAccessGuard
  ) {}

  /** Creates a case and seeds its checklist from the selected template. */
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

  /** Lists every active case the user can read, including computed capabilities. */
  async list(userId: string) {
    const caseRecords = await this.prisma.case.findMany({
      where: {
        ...buildCaseAccessWhere(userId, "READ"),
        archivedAt: null
      },
      orderBy: { updatedAt: "desc" },
      include: {
        ...buildCaseAccessInclude(userId),
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

    return caseRecords.map(({ collaborators, sharingSettings, ...caseRecord }) => ({
      ...caseRecord,
      access: createCaseAccess(userId, {
        collaborators,
        ownerId: caseRecord.ownerId,
        sharingSettings
      })
    }));
  }

  /** Returns the full active case workspace payload for an authorized user. */
  async get(userId: string, caseId: string) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ...buildCaseAccessWhere(userId, "READ"),
        archivedAt: null
      },
      include: {
        ...buildCaseAccessInclude(userId),
        caseType: true,
        documents: {
          select: {
            status: true
          }
        },
        checklist: checklistQuery,
        events: timelineQuery,
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

    const { collaborators, documents, sharingSettings, ...caseRecord } = foundCase;

    return {
      ...caseRecord,
      access: createCaseAccess(userId, {
        collaborators,
        ownerId: caseRecord.ownerId,
        sharingSettings
      }),
      documentStats: {
        failed: documents.filter((document) => document.status === DocumentStatus.FAILED).length,
        processed: documents.filter((document) => document.status === DocumentStatus.PROCESSED)
          .length,
        total: documents.length
      }
    };
  }

  /** Returns a paginated, user-facing activity stream for an accessible case. */
  async listActivity(
    userId: string,
    caseId: string,
    query: ListCaseActivityQueryDto
  ): Promise<CaseActivityResponse> {
    await this.access.require(userId, caseId, "READ");

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

  /** Updates editable case fields and emits a preference-aware status notification. */
  async update(userId: string, caseId: string, input: UpdateCaseDto) {
    const existingCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ...buildCaseAccessWhere(userId, "EDIT"),
        archivedAt: null
      },
      select: {
        id: true,
        ownerId: true,
        status: true,
        owner: {
          select: {
            preference: {
              select: {
                emailNotifications: true,
                inAppNotifications: true,
                notifyCaseUpdates: true
              }
            }
          }
        }
      }
    });

    if (!existingCase) {
      throw new NotFoundException("Case not found.");
    }

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

    return this.prisma.$transaction(async (tx) => {
      const updatedCase = await tx.case.update({
        where: { id: caseId },
        data,
        include: {
          caseType: true
        }
      });

      await tx.auditLog.create({
        data: {
          userId,
          caseId,
          action: "case.updated",
          metadata: toUpdateAuditMetadata(input)
        }
      });

      const preference = existingCase.owner.preference;
      const statusChanged =
        input.status !== undefined && input.status !== existingCase.status;
      const notificationDelivery = statusChanged
        ? buildNotificationDelivery({
            event: {
              body: `${updatedCase.title} is now ${formatCaseStatus(
                input.status ?? existingCase.status
              )}.`,
              caseId,
              title: "Case status updated",
              type: "case_status_updated",
              userId: existingCase.ownerId
            },
            preference: preference
              ? {
                  categoryEnabled: preference.notifyCaseUpdates,
                  emailNotifications: preference.emailNotifications,
                  inAppNotifications: preference.inAppNotifications
                }
              : null
          })
        : null;

      if (notificationDelivery) {
        await tx.notification.create({
          data: notificationDelivery.data
        });
      }

      return updatedCase;
    });
  }

  /** Archives an owner-controlled case while retaining its audit history. */
  async archive(userId: string, caseId: string) {
    await this.access.require(userId, caseId, "OWNER");

    const archivedCase = await this.prisma.case.update({
      where: { id: caseId },
      data: {
        archivedAt: new Date(),
        status: CaseStatus.ARCHIVED
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        caseId,
        action: "case.archived",
        metadata: { title: archivedCase.title }
      }
    });

    return { id: caseId, archived: true };
  }
}

/** Keeps audit metadata limited to fields supplied by the caller. */
function toUpdateAuditMetadata(input: UpdateCaseDto) {
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

/** Converts a database enum value into notification copy. */
function formatCaseStatus(status: CaseStatus) {
  return status.toLowerCase().replaceAll("_", " ");
}
