import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@proofpilot/database";
import { createHash, randomUUID } from "node:crypto";
import { getApiEnv } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { authUserSelect, type AuthUserRecord } from "./auth-user-record.js";

const portfolioDemoTemplateInclude = {
  assistantThreads: {
    include: { messages: { orderBy: { createdAt: "asc" } } }
  },
  auditLogs: { orderBy: { createdAt: "asc" } },
  billingSubscription: {
    include: { invoices: { orderBy: { issuedAt: "asc" } } }
  },
  cases: {
    include: {
      checklist: { orderBy: { createdAt: "asc" } },
      collaborators: { orderBy: { createdAt: "asc" } },
      documents: {
        include: {
          entities: { orderBy: { createdAt: "asc" } },
          eventSources: { orderBy: { createdAt: "asc" } },
          processingLogs: { orderBy: { createdAt: "asc" } },
          requirementMatches: { orderBy: { createdAt: "asc" } }
        },
        orderBy: { createdAt: "asc" },
        where: { storageKey: { startsWith: "demo-samples/" } }
      },
      events: {
        orderBy: [{ sortOrder: "asc" }, { occurredAt: "asc" }]
      },
      reminders: { orderBy: { createdAt: "asc" } },
      sharingSettings: true,
      statementGuidance: true,
      statements: {
        include: { versions: { orderBy: { version: "asc" } } },
        orderBy: { createdAt: "asc" }
      },
      summaries: { orderBy: { createdAt: "asc" } },
      submissions: {
        include: { updates: { orderBy: { occurredAt: "asc" } } },
        orderBy: { round: "asc" }
      },
      tasks: { orderBy: { createdAt: "asc" } }
    },
    orderBy: { createdAt: "asc" },
    where: { archivedAt: null }
  },
  connectedAccounts: { orderBy: { createdAt: "asc" } },
  notifications: { orderBy: { createdAt: "asc" } },
  preference: true,
  supportRequests: {
    include: { messages: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" }
  }
} satisfies Prisma.UserInclude;

type PortfolioDemoTemplate = Prisma.UserGetPayload<{
  include: typeof portfolioDemoTemplateInclude;
}>;

@Injectable()
export class PortfolioDemoWorkspaceService {
  private readonly config = getApiEnv();

  constructor(private readonly prisma: PrismaService) {}

  async resolveWorkspace(visitorToken: string): Promise<AuthUserRecord> {
    const visitorHash = createHash("sha256").update(visitorToken).digest("hex");
    const now = new Date();
    const existingWorkspace = await this.findActiveWorkspace(visitorHash, now);

    if (existingWorkspace) {
      return existingWorkspace;
    }

    const template = await this.prisma.user.findUnique({
      where: { email: this.config.PORTFOLIO_DEMO_TEMPLATE_EMAIL.toLowerCase() },
      include: portfolioDemoTemplateInclude
    });

    if (!template || template.isPortfolioDemo || !template.cases.length) {
      throw new ServiceUnavailableException(
        "The portfolio demo is being prepared. Please try again shortly."
      );
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await this.createWorkspace(template, visitorHash, now);
      } catch (error) {
        if (isPrismaError(error, "P2002")) {
          const concurrentWorkspace = await this.findActiveWorkspace(
            visitorHash,
            new Date()
          );

          if (concurrentWorkspace) {
            return concurrentWorkspace;
          }
        }

        if (isPrismaError(error, "P2034") && attempt === 0) {
          continue;
        }

        throw error;
      }
    }

    throw new ServiceUnavailableException("The portfolio demo could not be started.");
  }

  async resetWorkspace(visitorToken: string): Promise<AuthUserRecord> {
    const visitorHash = createHash("sha256").update(visitorToken).digest("hex");
    const now = new Date();

    await this.prisma.user.updateMany({
      where: {
        isPortfolioDemo: true,
        portfolioDemoVisitorHash: visitorHash
      },
      data: {
        portfolioDemoExpiresAt: now,
        portfolioDemoVisitorHash: null
      }
    });

    return this.resolveWorkspace(visitorToken);
  }

  private async findActiveWorkspace(visitorHash: string, now: Date) {
    return this.prisma.user.findFirst({
      where: {
        isPortfolioDemo: true,
        portfolioDemoExpiresAt: { gt: now },
        portfolioDemoVisitorHash: visitorHash
      },
      select: authUserSelect
    });
  }

  private createWorkspace(
    template: PortfolioDemoTemplate,
    visitorHash: string,
    now: Date
  ) {
    const expiresAt = new Date(
      now.getTime() + this.config.PORTFOLIO_DEMO_TTL_MINUTES * 60_000
    );

    return this.prisma.$transaction(
      async (transaction) => {
        const activeWorkspace = await transaction.user.findFirst({
          where: {
            isPortfolioDemo: true,
            portfolioDemoExpiresAt: { gt: now },
            portfolioDemoVisitorHash: visitorHash
          },
          select: authUserSelect
        });

        if (activeWorkspace) {
          return activeWorkspace;
        }

        await transaction.authSession.updateMany({
          where: {
            user: {
              isPortfolioDemo: true,
              portfolioDemoVisitorHash: visitorHash,
              OR: [
                { portfolioDemoExpiresAt: null },
                { portfolioDemoExpiresAt: { lte: now } }
              ]
            },
            revokedAt: null
          },
          data: { revokedAt: now }
        });
        await transaction.user.updateMany({
          where: {
            isPortfolioDemo: true,
            portfolioDemoVisitorHash: visitorHash,
            OR: [
              { portfolioDemoExpiresAt: null },
              { portfolioDemoExpiresAt: { lte: now } }
            ]
          },
          data: { portfolioDemoVisitorHash: null }
        });

        const activeWorkspaceCount = await transaction.user.count({
          where: {
            isPortfolioDemo: true,
            portfolioDemoExpiresAt: { gt: now }
          }
        });

        if (activeWorkspaceCount >= this.config.PORTFOLIO_DEMO_MAX_ACTIVE_WORKSPACES) {
          throw new ServiceUnavailableException(
            "The portfolio demo is currently at capacity. Please try again later."
          );
        }

        const workspace = await transaction.user.create({
          data: {
            createdAt: template.createdAt,
            email: createWorkspaceEmail(),
            isPortfolioDemo: true,
            name: template.name,
            passwordChangedAt: template.passwordChangedAt,
            passwordHash: template.passwordHash,
            portfolioDemoExpiresAt: expiresAt,
            portfolioDemoVisitorHash: visitorHash
          },
          select: authUserSelect
        });

        await this.cloneUserData(transaction, template, workspace.id, expiresAt);
        return workspace;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 20_000
      }
    );
  }

  private async cloneUserData(
    transaction: Prisma.TransactionClient,
    template: PortfolioDemoTemplate,
    userId: string,
    expiresAt: Date
  ) {
    if (template.preference) {
      await transaction.userPreference.create({
        data: {
          accentColor: template.preference.accentColor,
          analyticsUsageData: false,
          autoSave: template.preference.autoSave,
          cloudSync: template.preference.cloudSync,
          confirmBeforeDelete: template.preference.confirmBeforeDelete,
          defaultCaseStatus: template.preference.defaultCaseStatus,
          emailNotifications: false,
          exportFormat: template.preference.exportFormat,
          inAppNotifications: true,
          itemsPerPage: template.preference.itemsPerPage,
          lastSyncedAt: template.preference.lastSyncedAt,
          marketingCommunications: false,
          notifyCaseUpdates: template.preference.notifyCaseUpdates,
          notifyDeadlineReminders: template.preference.notifyDeadlineReminders,
          notifyEvidenceProcessing: template.preference.notifyEvidenceProcessing,
          notifyPacketReady: template.preference.notifyPacketReady,
          reduceMotion: template.preference.reduceMotion,
          syncOverCellular: template.preference.syncOverCellular,
          theme: template.preference.theme,
          userId
        }
      });
    }

    if (template.connectedAccounts.length) {
      await transaction.connectedAccount.createMany({
        data: template.connectedAccounts.map((connection) => ({
          accountLabel: connection.accountLabel,
          connectedAt: connection.connectedAt,
          lastSyncedAt: connection.lastSyncedAt,
          mode: connection.mode,
          provider: connection.provider,
          userId
        }))
      });
    }

    if (template.billingSubscription) {
      const subscription = template.billingSubscription;
      await transaction.billingSubscription.create({
        data: {
          billingCycle: subscription.billingCycle,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currency: subscription.currency,
          currentPeriodEnd: subscription.currentPeriodEnd,
          currentPeriodStart: subscription.currentPeriodStart,
          invoices: {
            create: subscription.invoices.map((invoice) => ({
              amountPaidCents: invoice.amountPaidCents,
              currency: invoice.currency,
              invoiceNumber: invoice.invoiceNumber,
              issuedAt: invoice.issuedAt,
              periodEnd: invoice.periodEnd,
              periodStart: invoice.periodStart,
              status: invoice.status
            }))
          },
          mode: subscription.mode,
          paymentBrand: subscription.paymentBrand,
          paymentExpMonth: subscription.paymentExpMonth,
          paymentExpYear: subscription.paymentExpYear,
          paymentLast4: subscription.paymentLast4,
          plan: subscription.plan,
          priceCents: subscription.priceCents,
          status: subscription.status,
          userId
        }
      });
    }

    const caseIds = new Map<string, string>();

    for (const sourceCase of template.cases) {
      const createdCase = await transaction.case.create({
        data: {
          caseTypeId: sourceCase.caseTypeId,
          createdAt: sourceCase.createdAt,
          deadline: sourceCase.deadline,
          ownerId: userId,
          platform: sourceCase.platform,
          status: sourceCase.status,
          summary: sourceCase.summary,
          title: sourceCase.title
        },
        select: { id: true }
      });
      caseIds.set(sourceCase.id, createdCase.id);

      if (sourceCase.sharingSettings) {
        await transaction.caseSharingSettings.create({
          data: {
            caseId: createdCase.id,
            invitationExpiryDays: sourceCase.sharingSettings.invitationExpiryDays,
            preventDownloads: sourceCase.sharingSettings.preventDownloads
          }
        });
      }

      if (sourceCase.collaborators.length) {
        await transaction.caseCollaborator.createMany({
          data: sourceCase.collaborators.map((collaborator) => ({
            acceptedAt: collaborator.acceptedAt,
            caseId: createdCase.id,
            email: collaborator.email,
            expiresAt: collaborator.expiresAt,
            invitedAt: collaborator.invitedAt,
            name: collaborator.name,
            role: collaborator.role,
            status: collaborator.status
          }))
        });
      }

      const checklistItemIds = new Map<string, string>();

      for (const item of sourceCase.checklist) {
        const createdItem = await transaction.caseChecklistItem.create({
          data: {
            caseId: createdCase.id,
            createdAt: item.createdAt,
            description: item.description,
            label: item.label,
            manuallyCompletedAt: item.manuallyCompletedAt,
            requirementId: item.requirementId,
            status: item.status
          },
          select: { id: true }
        });
        checklistItemIds.set(item.id, createdItem.id);
      }

      const eventIds = new Map<string, string>();

      for (const event of sourceCase.events) {
        const createdEvent = await transaction.caseEvent.create({
          data: {
            caseId: createdCase.id,
            confidence: event.confidence,
            createdAt: event.createdAt,
            description: event.description,
            occurredAt: event.occurredAt,
            sortOrder: event.sortOrder,
            title: event.title
          },
          select: { id: true }
        });
        eventIds.set(event.id, createdEvent.id);
      }

      const documentIds = new Map<string, string>();

      for (const document of sourceCase.documents) {
        const createdDocument = await transaction.document.create({
          data: {
            byteSize: document.byteSize,
            caseId: createdCase.id,
            createdAt: document.createdAt,
            extractedText: document.extractedText,
            mimeType: document.mimeType,
            originalName: document.originalName,
            sha256: document.sha256,
            source: document.source,
            sourceReference: document.sourceReference,
            status: document.status,
            storageKey: document.storageKey
          },
          select: { id: true }
        });
        documentIds.set(document.id, createdDocument.id);

        if (document.entities.length) {
          await transaction.documentEntity.createMany({
            data: document.entities.map((entity) => ({
              confidence: entity.confidence,
              createdAt: entity.createdAt,
              documentId: createdDocument.id,
              type: entity.type,
              value: entity.value
            }))
          });
        }

        if (document.processingLogs.length) {
          await transaction.documentProcessingLog.createMany({
            data: document.processingLogs.map((log) => ({
              createdAt: log.createdAt,
              documentId: createdDocument.id,
              message: log.message,
              status: log.status,
              step: log.step
            }))
          });
        }
      }

      for (const document of sourceCase.documents) {
        const documentId = documentIds.get(document.id);

        if (!documentId) {
          continue;
        }

        const requirementMatches = document.requirementMatches.flatMap((match) => {
          const checklistItemId = match.checklistItemId
            ? checklistItemIds.get(match.checklistItemId)
            : undefined;

          if (match.checklistItemId && !checklistItemId) {
            return [];
          }

          return [
            {
              ...(checklistItemId ? { checklistItemId } : {}),
              confidence: match.confidence,
              createdAt: match.createdAt,
              documentId,
              rationale: match.rationale,
              requirementId: match.requirementId
            }
          ];
        });

        if (requirementMatches.length) {
          await transaction.caseRequirementMatch.createMany({
            data: requirementMatches
          });
        }

        const eventSources = document.eventSources.flatMap((source) => {
          const eventId = eventIds.get(source.eventId);

          return eventId
            ? [
                {
                  createdAt: source.createdAt,
                  documentId,
                  eventId
                }
              ]
            : [];
        });

        if (eventSources.length) {
          await transaction.eventSource.createMany({ data: eventSources });
        }
      }

      for (const statement of sourceCase.statements) {
        await transaction.caseStatement.create({
          data: {
            caseId: createdCase.id,
            content: statement.content,
            createdAt: statement.createdAt,
            versions: {
              create: statement.versions.map((version) => ({
                content: version.content,
                createdAt: version.createdAt,
                version: version.version
              }))
            }
          }
        });
      }

      if (sourceCase.statementGuidance) {
        const guidance = sourceCase.statementGuidance;
        await transaction.statementGuidance.create({
          data: {
            accountUse: guidance.accountUse,
            actionDate: guidance.actionDate,
            caseId: createdCase.id,
            platformAction: guidance.platformAction,
            reasonGiven: guidance.reasonGiven,
            requestedOutcome: guidance.requestedOutcome,
            supportContact: guidance.supportContact,
            supportingDocuments: guidance.supportingDocuments
          }
        });
      }

      if (sourceCase.summaries.length) {
        await transaction.caseSummary.createMany({
          data: sourceCase.summaries.map((summary) => ({
            caseId: createdCase.id,
            content: summary.content,
            createdAt: summary.createdAt
          }))
        });
      }

      for (const submission of sourceCase.submissions) {
        await transaction.caseSubmission.create({
          data: {
            caseId: createdCase.id,
            channel: submission.channel,
            confirmationCode: submission.confirmationCode,
            createdAt: submission.createdAt,
            destination: submission.destination,
            notes: submission.notes,
            resolvedAt: submission.resolvedAt,
            responseDueAt: submission.responseDueAt,
            round: submission.round,
            status: submission.status,
            submittedAt: submission.submittedAt,
            updates: {
              create: submission.updates.map((update) => ({
                createdAt: update.createdAt,
                details: update.details,
                occurredAt: update.occurredAt,
                status: update.status,
                title: update.title,
                type: update.type
              }))
            }
          }
        });
      }

      if (sourceCase.reminders.length) {
        await transaction.reminder.createMany({
          data: sourceCase.reminders.map((reminder) => ({
            caseId: createdCase.id,
            completedAt: reminder.completedAt,
            createdAt: reminder.createdAt,
            message: reminder.message,
            remindAt: reminder.remindAt,
            sentAt: reminder.sentAt
          }))
        });
      }

      if (sourceCase.tasks.length) {
        await transaction.caseTask.createMany({
          data: sourceCase.tasks.map((task) => ({
            caseId: createdCase.id,
            completedAt: task.completedAt,
            createdAt: task.createdAt,
            description: task.description,
            dueAt: task.dueAt,
            priority: task.priority,
            progress: task.progress,
            status: task.status,
            title: task.title
          }))
        });
      }
    }

    for (const thread of template.assistantThreads) {
      const caseId = caseIds.get(thread.caseId);

      if (!caseId) {
        continue;
      }

      await transaction.assistantThread.create({
        data: {
          caseId,
          createdAt: thread.createdAt,
          messages: {
            create: thread.messages.map((message) => ({
              completionTokens: message.completionTokens,
              content: message.content,
              createdAt: message.createdAt,
              estimatedCostCents: message.estimatedCostCents,
              model: message.model,
              promptTokens: message.promptTokens,
              responseMode: message.responseMode,
              role: message.role
            }))
          },
          title: thread.title,
          userId
        }
      });
    }

    for (const request of template.supportRequests) {
      const caseId = request.caseId ? caseIds.get(request.caseId) : undefined;

      if (request.caseId && !caseId) {
        continue;
      }

      await transaction.supportRequest.create({
        data: {
          ...(caseId ? { caseId } : {}),
          category: request.category,
          createdAt: request.createdAt,
          message: request.message,
          messages: {
            create: request.messages.map((message) => ({
              author: message.author,
              createdAt: message.createdAt,
              message: message.message
            }))
          },
          priority: request.priority,
          readAt: request.readAt,
          status: request.status,
          subject: request.subject,
          userId
        }
      });
    }

    const notifications = template.notifications.flatMap((notification) => {
      const caseId = notification.caseId ? caseIds.get(notification.caseId) : undefined;

      if (notification.caseId && !caseId) {
        return [];
      }

      return [
        {
          body: notification.body,
          ...(caseId ? { caseId } : {}),
          createdAt: notification.createdAt,
          emailAttemptCount: 0,
          emailLastAttemptAt: null,
          emailLastErrorCode: null,
          emailNextAttemptAt: null,
          emailProviderId: null,
          emailSentAt: null,
          emailStatus: null,
          inAppVisible: notification.inAppVisible,
          readAt: notification.readAt,
          title: notification.title,
          type: notification.type,
          userId
        }
      ];
    });

    if (notifications.length) {
      await transaction.notification.createMany({ data: notifications });
    }

    const auditLogs = template.auditLogs.flatMap((log) => {
      const caseId = log.caseId ? caseIds.get(log.caseId) : undefined;

      if (log.caseId && !caseId) {
        return [];
      }

      return [
        {
          action: log.action,
          ...(caseId ? { caseId } : {}),
          createdAt: log.createdAt,
          metadata: log.metadata ?? Prisma.JsonNull,
          userId
        }
      ];
    });

    if (auditLogs.length) {
      await transaction.auditLog.createMany({ data: auditLogs });
    }

    await transaction.auditLog.create({
      data: {
        action: "portfolio.demo_workspace_created",
        metadata: {
          expiresAt: expiresAt.toISOString(),
          templateEmail: this.config.PORTFOLIO_DEMO_TEMPLATE_EMAIL
        },
        userId
      }
    });
  }
}

function createWorkspaceEmail() {
  return `nicholas.kerr+${randomUUID()}@portfolio.proofpilot.test`;
}

function isPrismaError(error: unknown, code: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}
