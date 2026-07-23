import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@proofpilot/database";
import { buildCaseAccessWhere } from "../common/case-access.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { CaseAccessGuard } from "./case-access.guard.js";
import {
  caseSummarySelect,
  statementGuidanceSelect,
  statementSelect,
  type StatementGuidanceRecord
} from "./case-selects.js";
import { generateAppealStatement } from "./case-statement-generation.js";
import { generateCaseSummary } from "./case-summary-generation.js";
import type { SaveStatementGuidanceDto } from "./dto/save-statement-guidance.dto.js";
import type { SaveStatementDto } from "./dto/save-statement.dto.js";

type StatementAuditAction =
  | "case.statement_generated"
  | "case.statement_restored"
  | "case.statement_saved";

/** Owns statement guidance, drafts, immutable versions, and generated summaries. */
export class CaseStatementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CaseAccessGuard
  ) {}

  /** Returns the latest draft, editable guidance, and recent summary history. */
  async get(userId: string, caseId: string) {
    await this.access.require(userId, caseId, "READ");

    const [statement, guidance, summaryHistory] = await Promise.all([
      this.prisma.caseStatement.findFirst({
        where: { caseId },
        orderBy: { updatedAt: "desc" },
        select: statementSelect
      }),
      this.prisma.statementGuidance.findUnique({
        where: { caseId },
        select: statementGuidanceSelect
      }),
      this.prisma.caseSummary.findMany({
        where: { caseId },
        orderBy: { createdAt: "desc" },
        select: caseSummarySelect,
        take: 5
      })
    ]);

    return {
      statement,
      guidance: toPublicStatementGuidance(guidance),
      summary: summaryHistory[0] ?? null,
      summaryHistory
    };
  }

  /** Saves a user-authored draft as the next immutable statement version. */
  async save(userId: string, caseId: string, input: SaveStatementDto) {
    await this.access.require(userId, caseId, "EDIT");
    return this.upsertDraft(userId, caseId, input.content, "case.statement_saved");
  }

  /** Persists normalized answers used by statement generation. */
  async saveGuidance(userId: string, caseId: string, input: SaveStatementGuidanceDto) {
    await this.access.require(userId, caseId, "EDIT");
    const data = normalizeStatementGuidance(input);

    const guidance = await this.prisma.$transaction(async (tx) => {
      const savedGuidance = await tx.statementGuidance.upsert({
        where: { caseId },
        update: data,
        create: {
          caseId,
          ...data
        },
        select: statementGuidanceSelect
      });

      await tx.auditLog.create({
        data: {
          userId,
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

    return toPublicStatementGuidance(guidance);
  }

  /** Builds an appeal draft from case evidence and stores it as a new version. */
  async generate(userId: string, caseId: string) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ...buildCaseAccessWhere(userId, "EDIT"),
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
    return this.upsertDraft(userId, caseId, content, "case.statement_generated");
  }

  /** Restores historical content by writing it as a new latest version. */
  async restore(userId: string, caseId: string, versionId: string) {
    await this.access.require(userId, caseId, "EDIT");
    const version = await this.prisma.statementVersion.findFirst({
      where: {
        id: versionId,
        statement: {
          caseId
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

    return this.upsertDraft(
      userId,
      caseId,
      version.content,
      "case.statement_restored",
      { restoredFromVersion: version.version }
    );
  }

  /** Generates and snapshots a concise case summary from current workspace data. */
  async generateSummary(userId: string, caseId: string) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ...buildCaseAccessWhere(userId, "EDIT"),
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
        select: caseSummarySelect
      });

      await tx.case.update({
        where: { id: caseId },
        data: { summary: content }
      });
      await tx.auditLog.create({
        data: {
          userId,
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

  /** Validates content and creates or advances the statement version sequence atomically. */
  private async upsertDraft(
    userId: string,
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
        ? await updateStatementWithVersion(tx, existingStatement.id, content)
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
            select: statementSelect
          });

      await tx.auditLog.create({
        data: {
          userId,
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
}

/** Advances a statement's monotonic version number inside the caller's transaction. */
async function updateStatementWithVersion(
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
    select: statementSelect
  });
}

/** Trims optional guidance fields while retaining empty values for the UI contract. */
function normalizeStatementGuidance(input: SaveStatementGuidanceDto) {
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

/** Maps nullable database fields to the form's string-only value contract. */
function toPublicStatementGuidance(guidance: StatementGuidanceRecord | null) {
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
