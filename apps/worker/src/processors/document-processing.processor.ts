import type { Job } from "bullmq";
import { DocumentStatus, getPrismaClient } from "@proofpilot/database";
import { readStoredObjectBytes } from "@proofpilot/storage";
import { PDFParse } from "pdf-parse";
import type { ProcessDocumentJobData } from "../queues/document-processing.queue.js";

const prisma = getPrismaClient();
const maxExtractedTextChars = 250_000;

interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
}

interface ProcessingResult {
  extractedText: string | null;
  entities: ExtractedEntity[];
  status: typeof DocumentStatus.PROCESSED | typeof DocumentStatus.NEEDS_REVIEW;
  step: string;
  message: string;
}

export async function processUploadedDocument(job: Job<ProcessDocumentJobData>) {
  const document = await prisma.document.findUnique({
    where: { id: job.data.documentId },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      storageKey: true,
      case: {
        select: {
          id: true,
          ownerId: true,
          platform: true,
          title: true
        }
      }
    }
  });

  if (!document) {
    throw new Error(`Document ${job.data.documentId} was not found.`);
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
    const result = await processDocumentContent(document);

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

    return {
      documentId: document.id,
      status: result.status
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document processing failed.";

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
      prisma.notification.create({
        data: {
          userId: document.case.ownerId,
          caseId: document.case.id,
          type: "processing_failed",
          title: "Evidence processing failed",
          body: `${document.originalName} needs review for ${document.case.title}. ${truncateMessage(message)}`
        }
      }),
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

async function processDocumentContent(document: {
  id: string;
  originalName: string;
  mimeType: string;
  storageKey: string;
}): Promise<ProcessingResult> {
  if (document.mimeType === "text/plain") {
    const bytes = await readStoredObjectBytes({ key: document.storageKey });
    const decodedText = new TextDecoder("utf-8").decode(bytes);
    const extractedText = limitExtractedText(normalizeText(decodedText));
    const entities = extractEntities(extractedText);

    if (!extractedText.trim()) {
      return {
        extractedText: null,
        entities: [],
        status: DocumentStatus.NEEDS_REVIEW,
        step: "extract_text_from_txt",
        message: "TXT file was readable but contained no extractable text."
      };
    }

    return {
      extractedText,
      entities,
      status: DocumentStatus.PROCESSED,
      step: "extract_text_from_txt",
      message: `Extracted ${extractedText.length} characters and ${entities.length} entities from TXT evidence.`
    };
  }

  if (document.mimeType === "application/pdf") {
    const bytes = await readStoredObjectBytes({ key: document.storageKey });
    const extractedText = await extractPdfText(bytes);
    const entities = extractEntities(extractedText);

    if (!extractedText.trim()) {
      return {
        extractedText: null,
        entities: [],
        status: DocumentStatus.NEEDS_REVIEW,
        step: "extract_text_from_pdf",
        message: "PDF was readable but did not contain extractable text. OCR may be required."
      };
    }

    return {
      extractedText,
      entities,
      status: DocumentStatus.PROCESSED,
      step: "extract_text_from_pdf",
      message: `Extracted ${extractedText.length} characters and ${entities.length} entities from PDF evidence.`
    };
  }

  if (document.mimeType === "image/png" || document.mimeType === "image/jpeg") {
    return adapterPendingResult(
      "extract_text_from_image",
      "Image OCR adapter is pending. Review the file manually for now."
    );
  }

  return adapterPendingResult(
    "classify_document",
    `No processing adapter is available for ${document.mimeType}.`
  );
}

function adapterPendingResult(step: string, message: string): ProcessingResult {
  return {
    extractedText: message,
    entities: [],
    status: DocumentStatus.NEEDS_REVIEW,
    step,
    message
  };
}

function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .split("\n")
    .filter((line) => !/^-- \d+ of \d+ --$/.test(line.trim()))
    .join("\n")
    .trim();
}

function limitExtractedText(value: string) {
  if (value.length <= maxExtractedTextChars) {
    return value;
  }

  return `${value.slice(0, maxExtractedTextChars)}\n\n[Truncated after ${maxExtractedTextChars} characters]`;
}

function truncateMessage(value: string) {
  return value.length <= 180 ? value : `${value.slice(0, 177)}...`;
}

async function extractPdfText(bytes: Buffer) {
  const parser = new PDFParse({ data: bytes });

  try {
    const result = await parser.getText();
    return limitExtractedText(normalizeText(result.text));
  } finally {
    await parser.destroy();
  }
}

function extractEntities(text: string) {
  const entities = new Map<string, ExtractedEntity>();

  addMatches(entities, "EMAIL", text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi), 0.96);
  addMatches(entities, "URL", text.match(/\bhttps?:\/\/[^\s<>"']+/gi), 0.92);
  addMatches(
    entities,
    "DATE",
    text.match(
      /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})\b/gi
    ),
    0.78
  );
  addMatches(entities, "AMOUNT", text.match(/\$[0-9][0-9,]*(?:\.[0-9]{2})?/g), 0.78);

  for (const platform of ["PayPal", "Cash App", "Stripe", "Venmo", "Amazon", "Facebook", "Instagram"]) {
    if (text.toLowerCase().includes(platform.toLowerCase())) {
      addEntity(entities, {
        type: "PLATFORM",
        value: platform,
        confidence: 0.82
      });
    }
  }

  return [...entities.values()].slice(0, 100);
}

function addMatches(
  entities: Map<string, ExtractedEntity>,
  type: string,
  matches: RegExpMatchArray | null,
  confidence: number
) {
  for (const value of matches ?? []) {
    addEntity(entities, {
      type,
      value: value.replace(/[),.;:]+$/, ""),
      confidence
    });
  }
}

function addEntity(entities: Map<string, ExtractedEntity>, entity: ExtractedEntity) {
  const key = `${entity.type}:${entity.value.toLowerCase()}`;

  if (!entities.has(key)) {
    entities.set(key, entity);
  }
}
