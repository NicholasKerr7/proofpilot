import { NotFoundException } from "@nestjs/common";
import {
  buildCaseAccessWhere,
  type CaseAccessRequirement
} from "../common/case-access.js";
import type { PrismaService } from "../prisma/prisma.service.js";

/** Enforces case authorization for document workflows without exposing foreign IDs. */
export class DocumentAccessGuard {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the case storage owner when the caller meets the access requirement. */
  async requireCase(userId: string, caseId: string, requirement: CaseAccessRequirement) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ...buildCaseAccessWhere(userId, requirement),
        archivedAt: null
      },
      select: { id: true, ownerId: true }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    return foundCase;
  }
}
