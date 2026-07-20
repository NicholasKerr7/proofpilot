import { PDFDocument as PdfLibDocument, PDFName, StandardFonts, rgb } from "pdf-lib";
import PDFDocument from "pdfkit";

export type PacketSupportingContentKind = "jpeg" | "pdf" | "png";

export interface PacketSupportingContent {
  bytes: Uint8Array;
  kind: PacketSupportingContentKind;
}

export interface PacketPdfCase {
  title: string;
  platform: string;
  summary: string | null;
  deadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
  caseType: {
    name: string;
  };
  owner: {
    email: string;
    name: string | null;
  };
  checklist: PacketPdfChecklistItem[];
  documents: PacketPdfDocument[];
  events: PacketPdfEvent[];
  statements: PacketPdfStatement[];
}

export interface PacketPdfResult {
  bytes: Buffer;
  includedDocumentCount: number;
  indexedDocumentCount: number;
  pageCount: number;
}

interface PacketPdfChecklistItem {
  label: string;
  description: string;
  status: string;
  matches: {
    confidence: number;
    rationale: string | null;
    document: {
      originalName: string;
    };
  }[];
}

export interface PacketPdfDocument {
  originalName: string;
  mimeType: string;
  byteSize: number;
  status: string;
  createdAt: Date;
  extractedText?: string | null;
  supportingContent?: PacketSupportingContent | null;
  supportingNote?: string | null;
}

interface PacketPdfEvent {
  occurredAt: Date;
  title: string;
  description: string | null;
  confidence: number | null;
  sources: {
    document: {
      originalName: string;
    };
  }[];
}

interface PacketPdfStatement {
  content: string;
  updatedAt: Date;
}

type PreparedInclusion =
  | {
      kind: "attachment";
      note: string;
      pageCount: number;
      source: PacketSupportingContent;
      sourcePdf: PdfLibDocument | null;
    }
  | {
      kind: "index";
      note: string;
    }
  | {
      kind: "text";
      note: string;
      text: string;
    };

type PreparedPacketPdfDocument = PacketPdfDocument & {
  inclusion: PreparedInclusion;
};

const margin = 54;
const bottomMargin = 120;
const maxAttachedPdfPages = 100;
const maxAttachedPages = 150;
const maxExtractedTextCharacters = 8_000;
const colors = {
  accent: "#bd6f3e",
  border: "#d7c4a2",
  graphite: "#2b2926",
  ink: "#1d1a17",
  muted: "#655f56",
  surface: "#fbf8f0"
};

export async function generateCasePacketPdf(input: PacketPdfCase): Promise<PacketPdfResult> {
  const preparedDocuments = await prepareDocuments(input.documents);
  const baseBytes = await generateBasePdf(input, preparedDocuments);
  const assembled = await assemblePacket(input, baseBytes, preparedDocuments);

  return {
    bytes: assembled.bytes,
    includedDocumentCount: preparedDocuments.filter(
      (document) => document.inclusion.kind !== "index"
    ).length,
    indexedDocumentCount: preparedDocuments.length,
    pageCount: assembled.pageCount
  };
}

async function prepareDocuments(documents: PacketPdfDocument[]) {
  const preparedDocuments: PreparedPacketPdfDocument[] = [];
  let attachedPageCount = 0;

  for (const document of documents) {
    const content = document.supportingContent;
    let attachmentFailure: string | null = null;

    if (content?.kind === "pdf") {
      try {
        const sourcePdf = await PdfLibDocument.load(content.bytes, {
          ignoreEncryption: false,
          updateMetadata: false
        });
        const pageCount = sourcePdf.getPageCount();

        if (!pageCount) {
          attachmentFailure = "The uploaded PDF contains no pages.";
        } else if (pageCount > maxAttachedPdfPages) {
          attachmentFailure = `The source PDF exceeds the ${maxAttachedPdfPages}-page per-file limit.`;
        } else if (attachedPageCount + pageCount > maxAttachedPages) {
          attachmentFailure = `Appending this PDF would exceed the ${maxAttachedPages}-page evidence limit.`;
        } else {
          attachedPageCount += pageCount;
          preparedDocuments.push({
            ...document,
            inclusion: {
              kind: "attachment",
              note: "Appended in evidence-index order.",
              pageCount,
              source: content,
              sourcePdf
            }
          });
          continue;
        }
      } catch {
        attachmentFailure = "The original PDF could not be safely opened.";
      }
    } else if (content?.kind === "jpeg" || content?.kind === "png") {
      if (attachedPageCount + 1 > maxAttachedPages) {
        attachmentFailure = `Appending this image would exceed the ${maxAttachedPages}-page evidence limit.`;
      } else {
        try {
          const probe = await PdfLibDocument.create();
          if (content.kind === "png") {
            await probe.embedPng(content.bytes);
          } else {
            await probe.embedJpg(content.bytes);
          }

          attachedPageCount += 1;
          preparedDocuments.push({
            ...document,
            inclusion: {
              kind: "attachment",
              note: "Appended in evidence-index order.",
              pageCount: 1,
              source: content,
              sourcePdf: null
            }
          });
          continue;
        } catch {
          attachmentFailure = "The original image could not be safely opened.";
        }
      }
    }

    const extractedText = sanitizeText(document.extractedText ?? "").slice(
      0,
      maxExtractedTextCharacters
    );

    if (extractedText) {
      preparedDocuments.push({
        ...document,
        inclusion: {
          kind: "text",
          note: joinNotes(
            "Extracted text included in the supporting documents section.",
            attachmentFailure,
            document.supportingNote ?? null
          ),
          text: extractedText
        }
      });
      continue;
    }

    preparedDocuments.push({
      ...document,
      inclusion: {
        kind: "index",
        note: joinNotes(
          "Indexed only; no renderable supporting content was available.",
          attachmentFailure,
          document.supportingNote ?? null
        )
      }
    });
  }

  return preparedDocuments;
}

function generateBasePdf(input: PacketPdfCase, documents: PreparedPacketPdfDocument[]) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      bufferPages: true,
      info: {
        Author: "ProofPilot",
        Subject: `${input.platform} appeal packet`,
        Title: input.title
      },
      margin,
      size: "LETTER"
    });

    doc.on("data", (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.from(chunk));
    });
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", reject);

    renderPacket(doc, input, documents);
    doc.end();
  });
}

async function assemblePacket(
  input: PacketPdfCase,
  baseBytes: Buffer,
  documents: PreparedPacketPdfDocument[]
) {
  const output = await PdfLibDocument.create();
  const basePdf = await PdfLibDocument.load(baseBytes, { updateMetadata: false });
  const basePages = await output.copyPages(basePdf, basePdf.getPageIndices());
  const attachmentTitleFont = await output.embedFont(StandardFonts.HelveticaBold);
  const pageLabels: string[] = [];

  for (const page of basePages) {
    output.addPage(page);
    pageLabels.push("ProofPilot case packet");
  }

  for (const document of documents) {
    if (document.inclusion.kind !== "attachment") {
      continue;
    }

    if (document.inclusion.source.kind === "pdf" && document.inclusion.sourcePdf) {
      const pages = await output.copyPages(
        document.inclusion.sourcePdf,
        document.inclusion.sourcePdf.getPageIndices()
      );

      for (const page of pages) {
        page.node.delete(PDFName.of("AA"));
        page.node.delete(PDFName.of("Annots"));
        output.addPage(page);
        pageLabels.push(document.originalName);
      }
      continue;
    }

    const page = output.addPage([612, 792]);
    const image =
      document.inclusion.source.kind === "png"
        ? await output.embedPng(document.inclusion.source.bytes)
        : await output.embedJpg(document.inclusion.source.bytes);
    const availableWidth = 504;
    const availableHeight = 648;
    const scale = Math.min(
      availableWidth / image.width,
      availableHeight / image.height,
      1
    );
    const width = image.width * scale;
    const height = image.height * scale;

    page.drawText(truncateText(sanitizeText(document.originalName), 78), {
      color: rgb(0.16, 0.15, 0.14),
      font: attachmentTitleFont,
      size: 11,
      x: margin,
      y: 734
    });
    page.drawImage(image, {
      height,
      width,
      x: (page.getWidth() - width) / 2,
      y: 58 + (availableHeight - height) / 2
    });
    pageLabels.push(document.originalName);
  }

  const footerFont = await output.embedFont(StandardFonts.Helvetica);
  const pages = output.getPages();

  pages.forEach((page, index) => {
    const width = page.getWidth();
    const label = truncateText(sanitizeText(pageLabels[index] ?? "ProofPilot case packet"), 58);
    const count = `Page ${index + 1} of ${pages.length}`;

    page.drawRectangle({
      color: rgb(1, 1, 1),
      height: 27,
      opacity: 0.9,
      width,
      x: 0,
      y: 0
    });
    page.drawLine({
      color: rgb(0.84, 0.77, 0.64),
      end: { x: width - margin, y: 26 },
      start: { x: margin, y: 26 },
      thickness: 0.5
    });
    page.drawText(label, {
      color: rgb(0.4, 0.37, 0.34),
      font: footerFont,
      size: 7.5,
      x: margin,
      y: 10
    });
    page.drawText(count, {
      color: rgb(0.4, 0.37, 0.34),
      font: footerFont,
      size: 7.5,
      x: width - margin - footerFont.widthOfTextAtSize(count, 7.5),
      y: 10
    });
  });

  output.setAuthor("ProofPilot");
  output.setCreator("ProofPilot");
  output.setProducer("ProofPilot packet generator");
  output.setSubject(`${input.platform} appeal packet`);
  output.setTitle(input.title);

  return {
    bytes: Buffer.from(await output.save()),
    pageCount: pages.length
  };
}

function renderPacket(
  doc: PDFKit.PDFDocument,
  input: PacketPdfCase,
  documents: PreparedPacketPdfDocument[]
) {
  renderCoverPage(doc, input);
  doc.addPage();
  renderCaseSummary(doc, input);
  renderStatement(doc, input.statements[0]?.content ?? null);
  renderTimeline(doc, input.events);
  renderChecklist(doc, input.checklist);
  renderEvidenceIndex(doc, documents);
  renderSupportingDocuments(doc, documents);
  renderNextSteps(doc);
}

function renderCoverPage(doc: PDFKit.PDFDocument, input: PacketPdfCase) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(colors.surface);
  doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(12).text("PROOFPILOT", margin, 64);
  doc
    .moveTo(margin, 88)
    .lineTo(doc.page.width - margin, 88)
    .lineWidth(1.25)
    .strokeColor(colors.border)
    .stroke();

  doc.moveDown(4);
  doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(28).text("Case Packet", {
    lineGap: 4
  });
  doc.moveDown(0.4);
  doc.fillColor(colors.graphite).fontSize(19).text(sanitizeText(input.title), {
    lineGap: 3
  });

  doc.moveDown(1.4);
  keyValue(doc, "Platform", input.platform);
  keyValue(doc, "Case type", input.caseType.name);
  keyValue(doc, "Prepared for", input.owner.name || input.owner.email);
  keyValue(doc, "Generated", formatDate(new Date()));
  if (input.deadline) {
    keyValue(doc, "Deadline", formatDate(input.deadline));
  }

  doc.moveDown(1.2);
  sectionEyebrow(doc, "Packet contents");
  bulletList(doc, [
    "Case summary",
    "User statement",
    "Timeline of events",
    "Evidence checklist",
    "Evidence index",
    "Supporting documents",
    "Next steps"
  ]);
}

function renderCaseSummary(doc: PDFKit.PDFDocument, input: PacketPdfCase) {
  sectionTitle(doc, "1. Case Summary");
  keyValue(doc, "Case title", input.title);
  keyValue(doc, "Platform", input.platform);
  keyValue(doc, "Case type", input.caseType.name);
  keyValue(doc, "Created", formatDate(input.createdAt));
  keyValue(doc, "Last updated", formatDate(input.updatedAt));
  if (input.deadline) {
    keyValue(doc, "Deadline", formatDate(input.deadline));
  }

  paragraph(doc, input.summary || "No case summary was provided yet.");
}

function renderStatement(doc: PDFKit.PDFDocument, statement: string | null) {
  sectionTitle(doc, "2. User Statement");
  paragraph(
    doc,
    statement ||
      "No user statement has been saved yet. Generate or save a statement before submitting this packet."
  );
}

function renderTimeline(doc: PDFKit.PDFDocument, events: PacketPdfEvent[]) {
  sectionTitle(doc, "3. Timeline of Events");

  if (!events.length) {
    paragraph(doc, "No timeline events have been generated yet.");
    return;
  }

  for (const event of events) {
    itemBlock(doc, `${formatDate(event.occurredAt)} - ${event.title}`, [
      event.description || "Generated from processed evidence.",
      event.sources.length
        ? `Sources: ${event.sources.map((source) => source.document.originalName).join("; ")}`
        : "Sources: None linked",
      event.confidence ? `Confidence: ${Math.round(event.confidence * 100)}%` : null
    ]);
  }
}

function renderChecklist(doc: PDFKit.PDFDocument, checklist: PacketPdfChecklistItem[]) {
  sectionTitle(doc, "4. Evidence Checklist");

  if (!checklist.length) {
    paragraph(doc, "No checklist requirements are attached to this case.");
    return;
  }

  for (const item of checklist) {
    const firstMatch = item.matches[0];
    itemBlock(doc, `${formatStatus(item.status)} - ${item.label}`, [
      item.description,
      firstMatch
        ? `Matched evidence: ${firstMatch.document.originalName} (${Math.round(firstMatch.confidence * 100)}%)`
        : "Matched evidence: None yet",
      firstMatch?.rationale ? `Rationale: ${firstMatch.rationale}` : null
    ]);
  }
}

function renderEvidenceIndex(doc: PDFKit.PDFDocument, documents: PreparedPacketPdfDocument[]) {
  sectionTitle(doc, "5. Evidence Index");

  if (!documents.length) {
    paragraph(doc, "No evidence files have been uploaded yet.");
    return;
  }

  documents.forEach((document, index) => {
    itemBlock(doc, `${index + 1}. ${document.originalName}`, [
      `Status: ${formatStatus(document.status)}`,
      `Type: ${document.mimeType}`,
      `Size: ${formatBytes(document.byteSize)}`,
      `Uploaded: ${formatDate(document.createdAt)}`,
      `Packet inclusion: ${getInclusionLabel(document.inclusion)}`,
      document.inclusion.note
    ]);
  });
}

function renderSupportingDocuments(
  doc: PDFKit.PDFDocument,
  documents: PreparedPacketPdfDocument[]
) {
  sectionTitle(doc, "6. Supporting Documents");
  const includedDocuments = documents.filter((document) => document.inclusion.kind !== "index");

  if (!documents.length) {
    paragraph(doc, "No supporting documents are available for this packet.");
    return;
  }

  paragraph(
    doc,
    `${includedDocuments.length} of ${documents.length} indexed ${documents.length === 1 ? "document is" : "documents are"} included as original pages or extracted text. Original pages follow the report in evidence-index order.`
  );

  documents.forEach((document, index) => {
    itemBlock(doc, `${index + 1}. ${document.originalName}`, [
      getInclusionLabel(document.inclusion),
      document.inclusion.note
    ]);

    if (document.inclusion.kind === "text") {
      sectionEyebrow(doc, `Extracted text - document ${index + 1}`);
      paragraph(doc, document.inclusion.text);
    }
  });
}

function renderNextSteps(doc: PDFKit.PDFDocument) {
  sectionTitle(doc, "7. Next Steps");
  bulletList(doc, [
    "Review the statement for accuracy before submitting it to the platform.",
    "Attach the generated packet and any requested raw evidence files.",
    "Keep a copy of support ticket IDs, submission confirmations, and response dates.",
    "Regenerate the packet after adding new evidence or revising the statement."
  ]);
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 150);
  doc.moveDown(0.7);
  doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(14).text(title, margin, doc.y);
  doc
    .moveTo(margin, doc.y + 6)
    .lineTo(doc.page.width - margin, doc.y + 6)
    .lineWidth(0.75)
    .strokeColor(colors.border)
    .stroke();
  doc.moveDown(1);
}

function sectionEyebrow(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 30);
  doc.fillColor(colors.accent).font("Helvetica-Bold").fontSize(10).text(title.toUpperCase(), margin, doc.y);
  doc.moveDown(0.5);
}

function keyValue(doc: PDFKit.PDFDocument, label: string, value: string) {
  const text = sanitizeText(value || "Not provided");
  const labelWidth = 106;
  const valueWidth = contentWidth(doc) - labelWidth;
  const rowHeight = Math.max(doc.heightOfString(text, { width: valueWidth }), doc.currentLineHeight());

  ensureSpace(doc, rowHeight + 7);
  const startY = doc.y;
  doc.fillColor(colors.muted).font("Helvetica-Bold").fontSize(9).text(label.toUpperCase(), margin, startY, {
    width: labelWidth
  });
  doc.fillColor(colors.ink).font("Helvetica").fontSize(10).text(text, margin + labelWidth, startY, {
    lineGap: 2,
    width: valueWidth
  });
  doc.x = margin;
  doc.y = startY + rowHeight + 7;
}

function paragraph(doc: PDFKit.PDFDocument, value: string) {
  const text = sanitizeText(value);
  ensureSpace(doc, Math.min(doc.heightOfString(text, { width: contentWidth(doc), lineGap: 3 }) + 10, 180));
  doc.fillColor(colors.ink).font("Helvetica").fontSize(10.5).text(text, margin, doc.y, {
    lineGap: 3,
    width: contentWidth(doc)
  });
  doc.moveDown(0.7);
}

function itemBlock(doc: PDFKit.PDFDocument, title: string, lines: Array<string | null>) {
  const bodyLines = lines.filter((line): line is string => Boolean(line));
  const body = bodyLines.map((line) => sanitizeText(line)).join("\n");
  const height =
    doc.heightOfString(sanitizeText(title), { width: contentWidth(doc) }) +
    doc.heightOfString(body, { width: contentWidth(doc) - 18, lineGap: 2 }) +
    26;

  ensureSpace(doc, Math.min(height, 180));
  doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(10.5).text(sanitizeText(title), margin, doc.y);

  if (body) {
    doc.moveDown(0.25);
    doc.fillColor(colors.muted).font("Helvetica").fontSize(9.5).text(body, margin + 14, doc.y, {
      lineGap: 2,
      width: contentWidth(doc) - 14
    });
  }

  doc.moveDown(0.8);
}

function bulletList(doc: PDFKit.PDFDocument, items: string[]) {
  for (const item of items) {
    const text = `- ${sanitizeText(item)}`;
    ensureSpace(doc, doc.heightOfString(text, { width: contentWidth(doc), lineGap: 2 }) + 5);
    doc.fillColor(colors.ink).font("Helvetica").fontSize(10.5).text(text, margin, doc.y, {
      lineGap: 2,
      width: contentWidth(doc)
    });
    doc.moveDown(0.25);
  }
  doc.moveDown(0.5);
}

function ensureSpace(doc: PDFKit.PDFDocument, requiredHeight: number) {
  if (doc.y + requiredHeight > doc.page.height - bottomMargin) {
    doc.addPage();
  }
}

function contentWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - margin * 2;
}

function sanitizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\r\n/g, "\n")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "-")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x09\x0a\x20-\x7e]/g, "?")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  }).format(value);
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getInclusionLabel(inclusion: PreparedInclusion) {
  if (inclusion.kind === "attachment") {
    return inclusion.source.kind === "pdf"
      ? `Original PDF appended (${inclusion.pageCount} ${inclusion.pageCount === 1 ? "page" : "pages"})`
      : "Original image appended (1 page)";
  }

  if (inclusion.kind === "text") {
    return "Extracted text appendix";
  }

  return "Evidence index entry only";
}

function joinNotes(...notes: Array<string | null>) {
  return notes.filter((note): note is string => Boolean(note)).join(" ");
}

function truncateText(value: string, maximumLength: number) {
  if (value.length <= maximumLength) {
    return value;
  }

  return `${value.slice(0, maximumLength - 3)}...`;
}
