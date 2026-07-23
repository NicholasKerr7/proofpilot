import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  buildCaseAccessSelect,
  buildCaseAccessWhere,
  type CaseAccessRequirement
} from "../common/case-access.js";
import type { PrismaService } from "../prisma/prisma.service.js";

/**
 * Enforces case-level authorization and cross-resource ownership invariants.
 *
 * Missing and unauthorized cases intentionally share the same response so the
 * API does not reveal whether another user's resource exists.
 */
export class CaseAccessGuard {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the accessible case record or raises the API's opaque not-found response. */
  async require(userId: string, caseId: string, requirement: CaseAccessRequirement) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ...buildCaseAccessWhere(userId, requirement),
        archivedAt: null
      },
      select: buildCaseAccessSelect(userId)
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    return foundCase;
  }

  /** Ensures every timeline source belongs to the case being edited. */
  async requireTimelineDocuments(caseId: string, documentIds: string[]) {
    if (!documentIds.length) {
      return;
    }

    const documents = await this.prisma.document.findMany({
      where: {
        id: { in: documentIds },
        caseId
      },
      select: { id: true }
    });

    if (documents.length !== documentIds.length) {
      throw new BadRequestException("Every timeline source must belong to this case.");
    }
  }
}
