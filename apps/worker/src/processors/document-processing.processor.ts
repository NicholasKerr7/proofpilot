import type { Job } from "bullmq";
import { DocumentStatus, getPrismaClient } from "@proofpilot/database";
import type { ProcessDocumentJobData } from "../queues/document-processing.queue.js";

const prisma = getPrismaClient();

export async function processUploadedDocument(job: Job<ProcessDocumentJobData>) {
  await prisma.document.update({
    where: { id: job.data.documentId },
    data: { status: DocumentStatus.PROCESSING }
  });

  await prisma.documentProcessingLog.create({
    data: {
      documentId: job.data.documentId,
      step: "process_uploaded_document",
      status: "started",
      message: "Document processing job accepted by worker."
    }
  });

  await prisma.document.update({
    where: { id: job.data.documentId },
    data: {
      status: DocumentStatus.NEEDS_REVIEW,
      extractedText: "Processing adapter stub: PDF, TXT, and OCR extraction will populate this field in Sprint 3."
    }
  });

  await prisma.documentProcessingLog.create({
    data: {
      documentId: job.data.documentId,
      step: "process_uploaded_document",
      status: "completed",
      message: "Document marked as needs review until extraction adapters are enabled."
    }
  });

  return {
    documentId: job.data.documentId,
    status: DocumentStatus.NEEDS_REVIEW
  };
}
