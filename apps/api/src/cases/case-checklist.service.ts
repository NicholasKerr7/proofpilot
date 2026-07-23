import { NotFoundException } from "@nestjs/common";
import {
  analyzeCaseChecklist,
  analyzeCaseChecklistTransaction,
  ChecklistStatus
} from "@proofpilot/database";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { CaseAccessGuard } from "./case-access.guard.js";
import type { CaseRecordsService } from "./case-records.service.js";
import { checklistQuery } from "./case-selects.js";
import type { UpdateChecklistItemDto } from "./dto/update-checklist-item.dto.js";

/** Owns checklist reads, evidence analysis, and manual completion overrides. */
export class CaseChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CaseAccessGuard,
    private readonly records: CaseRecordsService
  ) {}

  /** Lists case requirements and their strongest evidence matches. */
  async list(userId: string, caseId: string) {
    await this.access.require(userId, caseId, "READ");

    return this.prisma.caseChecklistItem.findMany({
      where: { caseId },
      ...checklistQuery
    });
  }

  /** Recomputes checklist evidence matches for all processed case documents. */
  async analyze(userId: string, caseId: string) {
    const caseAccess = await this.access.require(userId, caseId, "EDIT");
    const analysis = await analyzeCaseChecklist(this.prisma, {
      actorId: userId,
      caseId,
      ownerId: caseAccess.ownerId
    });

    if (!analysis) {
      throw new NotFoundException("Case not found.");
    }

    return this.records.get(userId, caseId);
  }

  /** Applies a manual completion override and refreshes derived case readiness. */
  async update(
    userId: string,
    caseId: string,
    itemId: string,
    input: UpdateChecklistItemDto
  ) {
    const caseAccess = await this.access.require(userId, caseId, "EDIT");

    await this.prisma.$transaction(async (tx) => {
      const checklistItem = await tx.caseChecklistItem.findFirst({
        where: {
          id: itemId,
          caseId
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
          userId,
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
        actorId: userId,
        caseId,
        ownerId: caseAccess.ownerId
      });

      if (!analysis) {
        throw new NotFoundException("Case not found.");
      }
    });

    return this.records.get(userId, caseId);
  }
}
