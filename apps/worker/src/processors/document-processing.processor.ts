import type { Job } from "bullmq";
import {
  analyzeCaseChecklist,
  DocumentStatus,
  getPrismaClient
} from "@proofpilot/database";
import { buildNotificationDelivery } from "@proofpilot/types";
import type { ProcessDocumentJobData } from "../queues/document-processing.queue.js";
import {
  extractDocumentContent,
  truncateProcessingMessage
} from "./document-content-extraction.js";

export {
  shutdownDocumentContentExtraction as shutdownDocumentProcessor
} from "./document-content-extraction.js";

const prisma = getPrismaClient();

/** Processes one verified document and persists extraction, entities, and derived readiness. */
export async function processUploadedDocument(job: Job<ProcessDocumentJobData>) {
  const document = await prisma.document.findUnique({
    where: { id: job.data.documentId },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      quarantinedAt: true,
      storageKey: true,
      uploadExpiredAt: true,
      case: {
        select: {
          id: true,
          ownerId: true,
          platform: true,
          title: true,
          owner: {
            select: {
              preference: {
                select: {
                  emailNotifications: true,
                  inAppNotifications: true,
                  notifyEvidenceProcessing: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!document) {
    throw new Error(`Document ${job.data.documentId} was not found.`);
  }

  if (document.quarantinedAt || document.uploadExpiredAt) {
    await prisma.documentProcessingLog.create({
      data: {
        documentId: document.id,
        step: "process_uploaded_document",
        status: "skipped",
        message: document.quarantinedAt
          ? "Worker skipped a quarantined document."
          : "Worker skipped an expired upload reservation."
      }
    });
    return;
  }

  await prisma.document.update({
    where: { id: document.id },
    data: { status: DocumentStatus.PROCESSING }
  });

  await prisma.documentProcessingLog.create({
    data: {
      documentId: document.id,
      step: "process_uploaded_document",
      status: "started",
      message: "Document processing job accepted by worker."
    }
  });

  try {
    const result = await extractDocumentContent(document);

    await prisma.$transaction([
      prisma.documentEntity.deleteMany({
        where: { documentId: document.id }
      }),
      prisma.document.update({
        where: { id: document.id },
        data: {
          status: result.status,
          extractedText: result.extractedText
        }
      }),
      ...(result.entities.length
        ? [
            prisma.documentEntity.createMany({
              data: result.entities.map((entity) => ({
                documentId: document.id,
                type: entity.type,
                value: entity.value,
                confidence: entity.confidence
              }))
            })
          ]
        : []),
      prisma.documentProcessingLog.create({
        data: {
          documentId: document.id,
          step: result.step,
          status: "completed",
          message: result.message
        }
      }),
      prisma.documentProcessingLog.create({
        data: {
          documentId: document.id,
          step: "process_uploaded_document",
          status: "completed",
          message:
            result.status === DocumentStatus.PROCESSED
              ? "Document processing completed."
              : "Document needs review before automated extraction can continue."
        }
      })
    ]);

    try {
      const checklistAnalysis = await analyzeCaseChecklist(prisma, {
        auditAction: "case.checklist_auto_analyzed",
        caseId: document.case.id,
        ownerId: document.case.ownerId,
        triggerDocumentId: document.id
      });

      if (!checklistAnalysis) {
        throw new Error("The case was unavailable for checklist refresh.");
      }

      await prisma.documentProcessingLog.create({
        data: {
          documentId: document.id,
          step: "refresh_case_checklist",
          status: "completed",
          message: `Checklist refreshed with ${checklistAnalysis.foundCount} ready and ${checklistAnalysis.missingCount} missing item(s).`
        }
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Checklist refresh failed after processing.";

      // Extraction remains successful when a derived checklist refresh can be retried later.
      await prisma.documentProcessingLog
        .create({
          data: {
            documentId: document.id,
            step: "refresh_case_checklist",
            status: "failed",
            message: truncateProcessingMessage(message)
          }
        })
        .catch(() => undefined);
    }

    return {
      documentId: document.id,
      status: result.status
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document processing failed.";
    const preference = document.case.owner.preference;
    const notificationDelivery = buildNotificationDelivery({
      event: {
        body: `${document.originalName} needs review for ${
          document.case.title
        }. ${truncateProcessingMessage(message)}`,
        caseId: document.case.id,
        title: "Evidence processing failed",
        type: "processing_failed",
        userId: document.case.ownerId
      },
      preference: preference
        ? {
            categoryEnabled: preference.notifyEvidenceProcessing,
            emailNotifications: preference.emailNotifications,
            inAppNotifications: preference.inAppNotifications
          }
        : null
    });

    await prisma.$transaction([
      prisma.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.FAILED }
      }),
      prisma.documentProcessingLog.create({
        data: {
          documentId: document.id,
          step: "process_uploaded_document",
          status: "failed",
          message
        }
      }),
      ...(notificationDelivery
        ? [
            prisma.notification.create({
              data: notificationDelivery.data
            })
          ]
        : []),
      prisma.auditLog.create({
        data: {
          userId: document.case.ownerId,
          caseId: document.case.id,
          action: "document.processing_failed",
          metadata: {
            documentId: document.id,
            message,
            originalName: document.originalName
          }
        }
      })
    ]);

    throw error;
  }
}
