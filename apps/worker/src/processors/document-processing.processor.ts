import type { Job } from "bullmq";
import {
  analyzeCaseChecklist,
  DocumentStatus,
  getPrismaClient
} from "@proofpilot/database";
import { readStoredObjectBytes } from "@proofpilot/storage";
import {
  csvMimeType,
  docxMimeType,
  emailMimeType,
  xlsxMimeType
} from "@proofpilot/types/evidence";
import type { AddressObject, ParsedMail } from "mailparser";
import { simpleParser } from "mailparser";
import mammoth from "mammoth";
import { mkdir } from "node:fs/promises";
import { PDFParse } from "pdf-parse";
import Tesseract from "tesseract.js";
import { getWorkerEnv } from "../config/env.js";
import type { ProcessDocumentJobData } from "../queues/document-processing.queue.js";
import {
  extractCsvEvidenceText,
  extractXlsxEvidenceText,
  type SpreadsheetExtractionResult
} from "./spreadsheet-extraction.js";

const prisma = getPrismaClient();
const maxExtractedTextChars = 250_000;
const workerEnv = getWorkerEnv();

type OcrWorker = Awaited<ReturnType<typeof Tesseract.createWorker>>;

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

let ocrWorkerPromise: Promise<OcrWorker> | null = null;

export async function processUploadedDocument(job: Job<ProcessDocumentJobData>) {
  const document = await prisma.document.findUnique({
    where: { id: job.data.documentId },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      quarantinedAt: true,
      storageKey: true,
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

  if (document.quarantinedAt) {
    await prisma.documentProcessingLog.create({
      data: {
        documentId: document.id,
        step: "process_uploaded_document",
        status: "skipped",
        message: "Worker skipped a quarantined document."
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
        error instanceof Error ? error.message : "Checklist refresh failed after processing.";

      await prisma.documentProcessingLog
        .create({
          data: {
            documentId: document.id,
            step: "refresh_case_checklist",
            status: "failed",
            message: truncateMessage(message)
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
    const shouldNotify =
      preference?.inAppNotifications !== false &&
      preference?.notifyEvidenceProcessing !== false;

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
      ...(shouldNotify
        ? [
            prisma.notification.create({
              data: {
                userId: document.case.ownerId,
                caseId: document.case.id,
                type: "processing_failed",
                title: "Evidence processing failed",
                body: `${document.originalName} needs review for ${document.case.title}. ${truncateMessage(message)}`
              }
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

  if (document.mimeType === docxMimeType) {
    const bytes = await readStoredObjectBytes({ key: document.storageKey });
    const result = await extractDocxText(bytes);
    const entities = extractEntities(result.extractedText);

    if (!result.extractedText.trim()) {
      return {
        extractedText: null,
        entities: [],
        status: DocumentStatus.NEEDS_REVIEW,
        step: "extract_text_from_docx",
        message: "DOCX was readable but did not contain extractable text."
      };
    }

    return {
      extractedText: result.extractedText,
      entities,
      status: DocumentStatus.PROCESSED,
      step: "extract_text_from_docx",
      message: `Extracted ${result.extractedText.length} characters and ${entities.length} entities from DOCX evidence.${formatDocxMessages(result.messageCount)}`
    };
  }

  if (document.mimeType === emailMimeType) {
    const bytes = await readStoredObjectBytes({ key: document.storageKey });
    const result = await extractEmailText(bytes);
    const entities = extractEntities(result.extractedText);

    if (!result.extractedText.trim()) {
      return {
        extractedText: null,
        entities: [],
        status: DocumentStatus.NEEDS_REVIEW,
        step: "extract_text_from_email",
        message: "Email export was readable but contained no extractable text."
      };
    }

    return {
      extractedText: result.extractedText,
      entities,
      status: DocumentStatus.PROCESSED,
      step: "extract_text_from_email",
      message: `Extracted ${result.extractedText.length} characters and ${entities.length} entities from EML evidence.${formatEmailAttachments(result.attachmentCount)}`
    };
  }

  if (document.mimeType === csvMimeType || document.mimeType === xlsxMimeType) {
    const bytes = await readStoredObjectBytes({ key: document.storageKey });
    const result =
      document.mimeType === csvMimeType
        ? extractCsvEvidenceText(bytes)
        : extractXlsxEvidenceText(bytes);
    const entities = extractEntities(result.extractedText);
    const label = document.mimeType === csvMimeType ? "CSV" : "XLSX";

    if (result.rowCount === 0) {
      return {
        extractedText: null,
        entities: [],
        status: DocumentStatus.NEEDS_REVIEW,
        step: "extract_text_from_spreadsheet",
        message: `${label} file was readable but contained no extractable rows.`
      };
    }

    return {
      extractedText: result.extractedText,
      entities,
      status: DocumentStatus.PROCESSED,
      step: "extract_text_from_spreadsheet",
      message: `Extracted ${result.extractedText.length} characters and ${entities.length} entities from ${label} evidence across ${result.rowCount} row(s).${formatSpreadsheetTruncation(result)}`
    };
  }

  if (document.mimeType === "image/png" || document.mimeType === "image/jpeg") {
    const bytes = await readStoredObjectBytes({ key: document.storageKey });
    const result = await extractImageText(bytes);
    const entities = extractEntities(result.extractedText);

    if (!result.extractedText.trim()) {
      return {
        extractedText: null,
        entities: [],
        status: DocumentStatus.NEEDS_REVIEW,
        step: "extract_text_from_image",
        message: "Image OCR completed but did not detect readable text."
      };
    }

    return {
      extractedText: result.extractedText,
      entities,
      status: DocumentStatus.PROCESSED,
      step: "extract_text_from_image",
      message: `Extracted ${result.extractedText.length} characters and ${entities.length} entities from image OCR.${formatOcrConfidence(result.confidence)}`
    };
  }

  return adapterPendingResult(
    "classify_document",
    `No processing adapter is available for ${document.mimeType}.`
  );
}

export async function shutdownDocumentProcessor() {
  if (!ocrWorkerPromise) {
    return;
  }

  const worker = await ocrWorkerPromise.catch(() => null);
  ocrWorkerPromise = null;
  await worker?.terminate();
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

async function extractDocxText(bytes: Buffer) {
  const result = await mammoth.extractRawText({ buffer: bytes });

  return {
    extractedText: limitExtractedText(normalizeText(result.value)),
    messageCount: result.messages.length
  };
}

function formatDocxMessages(messageCount: number) {
  return messageCount ? ` Mammoth returned ${messageCount} parser message(s).` : "";
}

async function extractEmailText(bytes: Buffer) {
  const mail = await simpleParser(bytes, {
    maxHtmlLengthToParse: 500_000
  });
  const extractedText = limitExtractedText(normalizeText(formatEmailForEvidence(mail)));

  return {
    attachmentCount: mail.attachments.length,
    extractedText
  };
}

function formatEmailForEvidence(mail: ParsedMail) {
  const bodyText =
    mail.text?.trim() || (typeof mail.html === "string" ? htmlToPlainText(mail.html) : "");
  const lines = [
    "Email export",
    `Subject: ${mail.subject?.trim() || "No subject"}`,
    `From: ${formatAddressObject(mail.from)}`,
    `To: ${formatAddressObjects(mail.to)}`,
    `Cc: ${formatAddressObjects(mail.cc)}`,
    `Date: ${mail.date?.toISOString() ?? "No date header"}`,
    `Message-ID: ${mail.messageId ?? "No message ID"}`,
    `Attachments: ${formatAttachmentList(mail)}`,
    "",
    "Body",
    bodyText || "No email body text found."
  ];

  return lines.join("\n");
}

function formatAddressObjects(addresses: AddressObject | AddressObject[] | undefined) {
  if (!addresses) {
    return "None";
  }

  return (Array.isArray(addresses) ? addresses : [addresses])
    .map(formatAddressObject)
    .filter(Boolean)
    .join("; ");
}

function formatAddressObject(address: AddressObject | undefined) {
  return address?.text?.trim() || "None";
}

function formatAttachmentList(mail: ParsedMail) {
  if (!mail.attachments.length) {
    return "None";
  }

  return mail.attachments
    .map((attachment) => {
      const filename = attachment.filename?.trim() || "unnamed attachment";
      return `${filename} (${attachment.contentType}, ${attachment.size} bytes)`;
    })
    .join("; ");
}

function htmlToPlainText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function formatEmailAttachments(attachmentCount: number) {
  return attachmentCount ? ` ${attachmentCount} attachment(s) were indexed by filename.` : "";
}

function formatSpreadsheetTruncation(result: SpreadsheetExtractionResult) {
  return result.truncated
    ? ` Preview was truncated across ${result.sheetCount} sheet(s).`
    : "";
}

async function extractImageText(bytes: Buffer) {
  const worker = await getOcrWorker();
  const result = await worker.recognize(bytes);

  return {
    confidence: result.data.confidence,
    extractedText: limitExtractedText(normalizeText(result.data.text))
  };
}

function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createOcrWorker().catch((error) => {
      ocrWorkerPromise = null;
      throw error;
    });
  }

  return ocrWorkerPromise;
}

async function createOcrWorker() {
  await mkdir(workerEnv.OCR_CACHE_PATH, { recursive: true });

  const options: Partial<Tesseract.WorkerOptions> = {
    cachePath: workerEnv.OCR_CACHE_PATH
  };

  if (workerEnv.TESSERACT_LANG_PATH) {
    options.langPath = workerEnv.TESSERACT_LANG_PATH;
  }

  const worker = await Tesseract.createWorker(
    workerEnv.OCR_LANGUAGES,
    Tesseract.OEM.LSTM_ONLY,
    options
  );
  await worker.setParameters({
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT
  });

  return worker;
}

function formatOcrConfidence(confidence: number) {
  return Number.isFinite(confidence) ? ` Average confidence: ${Math.round(confidence)}%.` : "";
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
