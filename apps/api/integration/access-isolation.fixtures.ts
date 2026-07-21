import { randomUUID } from "node:crypto";
import type { PrismaService } from "../src/prisma/prisma.service.js";

export const ownerEmail = "nicholas.kerr@proofpilot.test";
export const isolationRunId = `isolation-${randomUUID()}`;
export const attackerEmail = `${isolationRunId}@proofpilot.test`;
export const isolationIds = {
  case: `${isolationRunId}-case`,
  checklist: `${isolationRunId}-checklist`,
  collaborator: `${isolationRunId}-collaborator`,
  document: `${isolationRunId}-document`,
  event: `${isolationRunId}-event`,
  export: `${isolationRunId}-export`,
  notification: `${isolationRunId}-notification`,
  packet: `${isolationRunId}-packet`,
  reminder: `${isolationRunId}-reminder`,
  share: `${isolationRunId}-share`,
  statement: `${isolationRunId}-statement`,
  statementVersion: `${isolationRunId}-statement-version`,
  summary: `${isolationRunId}-summary`,
  support: `${isolationRunId}-support`,
  thread: `${isolationRunId}-thread`
};

export async function createIsolationCase(client: PrismaService, ownerId: string) {
  const caseType = await client.caseType.findUnique({
    where: { slug: "account-ban-appeal" },
    select: { id: true }
  });

  if (!caseType) {
    throw new Error("Run pnpm db:seed before the access-isolation integration suite.");
  }

  await client.case.create({
    data: {
      id: isolationIds.case,
      caseTypeId: caseType.id,
      ownerId,
      platform: "Isolation platform",
      status: "DRAFT",
      summary: "Foreign fixture summary",
      title: "Foreign ownership fixture"
    }
  });
  await createForeignResources(client, ownerId);
}

export async function removeIsolationFixtures(client: PrismaService) {
  await client.supportRequest.deleteMany({ where: { id: isolationIds.support } });
  await client.case.deleteMany({ where: { id: isolationIds.case } });
  await client.user.deleteMany({ where: { email: attackerEmail } });
}

export async function readProtectedState(client: PrismaService) {
  const [
    caseRecord,
    event,
    checklist,
    statement,
    statementVersion,
    reminder,
    notification,
    collaborator,
    document,
    packet,
    share,
    support,
    eventCount,
    checklistCount,
    versionCount,
    summaryCount,
    packetCount,
    threadCount,
    auditCount
  ] = await client.$transaction([
    client.case.findUnique({
      where: { id: isolationIds.case },
      select: { archivedAt: true, status: true, summary: true, title: true }
    }),
    client.caseEvent.findUnique({
      where: { id: isolationIds.event },
      select: { description: true, sortOrder: true, title: true }
    }),
    client.caseChecklistItem.findUnique({
      where: { id: isolationIds.checklist },
      select: { manuallyCompletedAt: true, status: true }
    }),
    client.caseStatement.findUnique({
      where: { id: isolationIds.statement },
      select: { content: true }
    }),
    client.statementVersion.findUnique({
      where: { id: isolationIds.statementVersion },
      select: { content: true, version: true }
    }),
    client.reminder.findUnique({
      where: { id: isolationIds.reminder },
      select: { completedAt: true, message: true, remindAt: true, sentAt: true }
    }),
    client.notification.findUnique({
      where: { id: isolationIds.notification },
      select: { readAt: true }
    }),
    client.caseCollaborator.findUnique({
      where: { id: isolationIds.collaborator },
      select: { role: true, status: true }
    }),
    client.document.findUnique({
      where: { id: isolationIds.document },
      select: { status: true, storageKey: true }
    }),
    client.casePacket.findUnique({
      where: { id: isolationIds.packet },
      select: { status: true }
    }),
    client.packetShare.findUnique({
      where: { id: isolationIds.share },
      select: { revokedAt: true }
    }),
    client.supportRequest.findUnique({
      where: { id: isolationIds.support },
      select: { status: true, subject: true }
    }),
    client.caseEvent.count({ where: { caseId: isolationIds.case } }),
    client.caseChecklistItem.count({ where: { caseId: isolationIds.case } }),
    client.statementVersion.count({
      where: { statement: { caseId: isolationIds.case } }
    }),
    client.caseSummary.count({ where: { caseId: isolationIds.case } }),
    client.casePacket.count({ where: { caseId: isolationIds.case } }),
    client.assistantThread.count({ where: { caseId: isolationIds.case } }),
    client.auditLog.count({ where: { caseId: isolationIds.case } })
  ]);

  return {
    auditCount,
    caseRecord,
    checklist,
    checklistCount,
    collaborator,
    document,
    event,
    eventCount,
    notification,
    packet,
    packetCount,
    reminder,
    share,
    statement,
    statementVersion,
    summaryCount,
    support,
    threadCount,
    versionCount
  };
}

async function createForeignResources(client: PrismaService, ownerId: string) {
  const statement = await client.caseStatement.create({
    data: {
      id: isolationIds.statement,
      caseId: isolationIds.case,
      content: "Foreign statement content"
    }
  });
  const packet = await client.casePacket.create({
    data: { id: isolationIds.packet, caseId: isolationIds.case, status: "READY" }
  });
  const packetExport = await client.packetExport.create({
    data: {
      id: isolationIds.export,
      byteSize: 1024,
      includedDocumentCount: 1,
      indexedDocumentCount: 1,
      packetId: packet.id,
      pageCount: 1,
      storageKey: `integration/${isolationIds.export}.pdf`
    }
  });

  await client.$transaction([
    client.caseEvent.create({
      data: {
        id: isolationIds.event,
        caseId: isolationIds.case,
        description: "Foreign event description",
        occurredAt: new Date("2026-07-01T12:00:00.000Z"),
        sortOrder: 0,
        title: "Foreign timeline event"
      }
    }),
    client.caseChecklistItem.create({
      data: {
        id: isolationIds.checklist,
        caseId: isolationIds.case,
        description: "Foreign checklist description",
        label: "Foreign checklist item",
        status: "MISSING"
      }
    }),
    client.statementVersion.create({
      data: {
        id: isolationIds.statementVersion,
        content: statement.content,
        statementId: statement.id,
        version: 1
      }
    }),
    client.statementGuidance.create({
      data: {
        id: `${isolationRunId}-guidance`,
        caseId: isolationIds.case,
        platformAction: "Foreign platform action"
      }
    }),
    client.caseSummary.create({
      data: {
        id: isolationIds.summary,
        caseId: isolationIds.case,
        content: "Foreign case summary"
      }
    }),
    client.reminder.create({
      data: {
        id: isolationIds.reminder,
        caseId: isolationIds.case,
        message: "Foreign reminder",
        remindAt: new Date("2026-08-01T12:00:00.000Z")
      }
    }),
    client.notification.create({
      data: {
        id: isolationIds.notification,
        body: "Foreign notification body",
        caseId: isolationIds.case,
        title: "Foreign notification",
        type: "integration_fixture",
        userId: ownerId
      }
    }),
    client.caseCollaborator.create({
      data: {
        id: isolationIds.collaborator,
        caseId: isolationIds.case,
        email: "foreign-collaborator@proofpilot.test",
        role: "VIEWER",
        status: "ACTIVE"
      }
    }),
    client.caseSharingSettings.create({
      data: { id: `${isolationRunId}-sharing-settings`, caseId: isolationIds.case }
    }),
    client.document.create({
      data: {
        id: isolationIds.document,
        byteSize: 1024,
        caseId: isolationIds.case,
        mimeType: "application/pdf",
        originalName: "foreign-document.pdf",
        status: "PROCESSED",
        storageKey: `integration/${isolationIds.document}.pdf`
      }
    }),
    client.packetShare.create({
      data: {
        id: isolationIds.share,
        caseId: isolationIds.case,
        createdById: ownerId,
        packetExportId: packetExport.id,
        tokenHash: `${isolationRunId}-token-hash`
      }
    }),
    client.supportRequest.create({
      data: {
        id: isolationIds.support,
        caseId: isolationIds.case,
        category: "CASE_ASSISTANCE",
        message: "Foreign support request message",
        priority: "NORMAL",
        status: "OPEN",
        subject: "Foreign support request",
        userId: ownerId
      }
    }),
    client.assistantThread.create({
      data: {
        id: isolationIds.thread,
        caseId: isolationIds.case,
        title: "Foreign assistant thread",
        userId: ownerId
      }
    })
  ]);
}
