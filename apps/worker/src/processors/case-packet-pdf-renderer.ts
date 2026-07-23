import PDFDocument from "pdfkit";
import { formatCaseReference } from "@proofpilot/types";
import {
  formatPacketBytes as formatBytes,
  formatPacketDate as formatDate,
  formatPacketStatus as formatStatus,
  getPacketInclusionLabel as getInclusionLabel,
  sanitizePacketText as sanitizeText
} from "./case-packet-pdf-format.js";
import {
  packetPdfBottomMargin as bottomMargin,
  packetPdfColors as colors,
  packetPdfMargin as margin
} from "./case-packet-pdf-layout.js";
import type {
  PacketPdfCase,
  PacketPdfChecklistItem,
  PacketPdfEvent,
  PreparedPacketPdfDocument
} from "./case-packet-pdf-types.js";

/** Renders the ProofPilot-authored report pages before original evidence is appended. */
export function generateBasePacketPdf(
  input: PacketPdfCase,
  documents: PreparedPacketPdfDocument[]
) {
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
      size: "A4"
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

/** Renders report sections in their stable packet order. */
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

/** Renders the branded cover page used by packet preview and export. */
function renderCoverPage(doc: PDFKit.PDFDocument, input: PacketPdfCase) {
  const coverBackground = "#081117";
  const coverAccent = "#ff6b16";
  const coverForeground = "#f3f4f5";
  const coverMuted = "#8d969f";
  const coverX = 74;
  const coverWidth = doc.page.width - coverX * 2;
  const title = sanitizeText(input.title);
  const titleFontSize = title.length > 85 ? 20 : title.length > 52 ? 23 : 26;
  const titleOptions = {
    ellipsis: true,
    height: 104,
    lineGap: 4,
    width: coverWidth
  };

  doc.rect(0, 0, doc.page.width, doc.page.height).fill(coverBackground);
  doc
    .save()
    .fillColor(coverAccent)
    .fillOpacity(0.028)
    .circle(doc.page.width - 112, doc.page.height - 214, 122)
    .fill()
    .restore();
  doc
    .roundedRect(18, 18, doc.page.width - 36, doc.page.height - 36, 7)
    .lineWidth(0.6)
    .strokeColor("#25323a")
    .stroke();

  drawProofPilotMark(doc, {
    background: coverBackground,
    color: coverAccent,
    opacity: 1,
    size: 29,
    x: coverX,
    y: 68
  });

  doc
    .fillColor(coverForeground)
    .font("Helvetica-BoldOblique")
    .fontSize(17)
    .text("Proof", coverX + 37, 71, { continued: true });
  doc.fillColor(coverAccent).text("Pilot");

  doc
    .moveTo(coverX, 160)
    .lineTo(doc.page.width - coverX, 160)
    .lineWidth(1)
    .strokeColor("#d95718")
    .stroke();

  doc
    .fillColor(coverForeground)
    .font("Helvetica-Bold")
    .fontSize(titleFontSize)
    .text(title, coverX, 218, titleOptions);

  const titleHeight = Math.min(
    doc.heightOfString(title, {
      lineGap: titleOptions.lineGap,
      width: titleOptions.width
    }),
    titleOptions.height
  );
  const referenceY = 218 + titleHeight + 48;
  const preparedForY = Math.max(referenceY + 70, 404);
  const preparedByY = preparedForY + 114;

  doc
    .fillColor(coverAccent)
    .font("Helvetica")
    .fontSize(12)
    .text(`Case ID: ${formatCaseReference(input)}`, coverX, referenceY, {
      width: coverWidth
    });

  coverKeyValue(
    doc,
    "Prepared for:",
    `${sanitizeText(input.platform)} Account Review Team`,
    coverX,
    preparedForY,
    coverWidth,
    coverForeground,
    coverMuted
  );
  coverKeyValue(
    doc,
    "Prepared by:",
    input.owner.name || input.owner.email,
    coverX,
    preparedByY,
    coverWidth,
    coverForeground,
    coverMuted
  );

  drawProofPilotMark(doc, {
    background: coverBackground,
    color: "#5f2e1c",
    opacity: 0.48,
    size: 185,
    x: doc.page.width - 260,
    y: doc.page.height - 326
  });

  doc
    .fillColor(coverMuted)
    .font("Helvetica")
    .fontSize(10.5)
    .text(formatDate(new Date()), coverX, doc.page.height - 104, {
      width: coverWidth
    });
}

/** Renders one label/value group on the cover. */
function coverKeyValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  foreground: string,
  muted: string
) {
  doc.fillColor(muted).font("Helvetica").fontSize(9.5).text(label, x, y, { width });
  doc
    .fillColor(foreground)
    .font("Helvetica")
    .fontSize(12)
    .text(sanitizeText(value || "Not provided"), x, y + 17, {
      height: 34,
      lineGap: 2,
      width
    });
}

interface ProofPilotMarkOptions {
  background: string;
  color: string;
  opacity: number;
  size: number;
  x: number;
  y: number;
}

/** Draws the vector ProofPilot mark directly into PDFKit output. */
function drawProofPilotMark(
  doc: PDFKit.PDFDocument,
  { background, color, opacity, size, x, y }: ProofPilotMarkOptions
) {
  const point = (horizontal: number, vertical: number) =>
    `${x + (horizontal / 100) * size} ${y + (vertical / 100) * size}`;
  const outerPath = [
    `M ${point(7, 78)}`,
    `L ${point(20, 16)}`,
    `C ${point(22, 7)} ${point(27, 3)} ${point(37, 3)}`,
    `L ${point(69, 3)}`,
    `C ${point(86, 3)} ${point(97, 15)} ${point(94, 31)}`,
    `L ${point(90, 47)}`,
    `C ${point(87, 60)} ${point(77, 67)} ${point(64, 67)}`,
    `L ${point(49, 67)}`,
    `L ${point(25, 93)}`,
    `L ${point(32, 67)}`,
    `L ${point(20, 67)}`,
    `Z`
  ].join(" ");
  const innerPath = [
    `M ${point(37, 24)}`,
    `L ${point(66, 24)}`,
    `C ${point(74, 24)} ${point(79, 29)} ${point(77, 36)}`,
    `L ${point(75, 41)}`,
    `C ${point(73, 47)} ${point(68, 50)} ${point(61, 50)}`,
    `L ${point(31, 50)}`,
    `Z`
  ].join(" ");
  const starX = x + size * 0.93;
  const starY = y + size * 0.09;
  const starRadius = size * 0.09;

  doc.save().fillColor(color).fillOpacity(opacity).path(outerPath).fill();
  doc.fillOpacity(1).fillColor(background).path(innerPath).fill();
  doc
    .fillColor(color)
    .fillOpacity(opacity)
    .path(
      [
        `M ${starX} ${starY - starRadius}`,
        `L ${starX + starRadius * 0.2} ${starY - starRadius * 0.2}`,
        `L ${starX + starRadius} ${starY}`,
        `L ${starX + starRadius * 0.2} ${starY + starRadius * 0.2}`,
        `L ${starX} ${starY + starRadius}`,
        `L ${starX - starRadius * 0.2} ${starY + starRadius * 0.2}`,
        `L ${starX - starRadius} ${starY}`,
        `L ${starX - starRadius * 0.2} ${starY - starRadius * 0.2}`,
        "Z"
      ].join(" ")
    )
    .fill()
    .restore();
}

/** Renders core case metadata and the saved summary. */
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

/** Renders the current appeal statement or its missing-state guidance. */
function renderStatement(doc: PDFKit.PDFDocument, statement: string | null) {
  sectionTitle(doc, "2. User Statement");
  paragraph(
    doc,
    statement ||
      "No user statement has been saved yet. Generate or save a statement before submitting this packet."
  );
}

/** Renders chronological case events and linked sources. */
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

/** Renders evidence requirements and their strongest match. */
function renderChecklist(
  doc: PDFKit.PDFDocument,
  checklist: PacketPdfChecklistItem[]
) {
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
        ? `Matched evidence: ${firstMatch.document.originalName} (${Math.round(
            firstMatch.confidence * 100
          )}%)`
        : "Matched evidence: None yet",
      firstMatch?.rationale ? `Rationale: ${firstMatch.rationale}` : null
    ]);
  }
}

/** Renders the complete evidence manifest and inclusion outcome. */
function renderEvidenceIndex(
  doc: PDFKit.PDFDocument,
  documents: PreparedPacketPdfDocument[]
) {
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

/** Renders extracted text appendices and describes appended originals. */
function renderSupportingDocuments(
  doc: PDFKit.PDFDocument,
  documents: PreparedPacketPdfDocument[]
) {
  sectionTitle(doc, "6. Supporting Documents");
  const includedDocuments = documents.filter(
    (document) => document.inclusion.kind !== "index"
  );

  if (!documents.length) {
    paragraph(doc, "No supporting documents are available for this packet.");
    return;
  }

  paragraph(
    doc,
    `${includedDocuments.length} of ${documents.length} indexed ${
      documents.length === 1 ? "document is" : "documents are"
    } included as original pages or extracted text. Original pages follow the report in evidence-index order.`
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

/** Renders practical submission follow-up guidance. */
function renderNextSteps(doc: PDFKit.PDFDocument) {
  sectionTitle(doc, "7. Next Steps");
  bulletList(doc, [
    "Review the statement for accuracy before submitting it to the platform.",
    "Attach the generated packet and any requested raw evidence files.",
    "Keep a copy of support ticket IDs, submission confirmations, and response dates.",
    "Regenerate the packet after adding new evidence or revising the statement."
  ]);
}

/** Begins a numbered packet section with page-space protection. */
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

/** Renders a compact subsection label. */
function sectionEyebrow(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 30);
  doc
    .fillColor(colors.accent)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(title.toUpperCase(), margin, doc.y);
  doc.moveDown(0.5);
}

/** Renders one aligned metadata row. */
function keyValue(doc: PDFKit.PDFDocument, label: string, value: string) {
  const text = sanitizeText(value || "Not provided");
  const labelWidth = 106;
  const valueWidth = contentWidth(doc) - labelWidth;
  const rowHeight = Math.max(
    doc.heightOfString(text, { width: valueWidth }),
    doc.currentLineHeight()
  );

  ensureSpace(doc, rowHeight + 7);
  const startY = doc.y;
  doc
    .fillColor(colors.muted)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(label.toUpperCase(), margin, startY, {
      width: labelWidth
    });
  doc
    .fillColor(colors.ink)
    .font("Helvetica")
    .fontSize(10)
    .text(text, margin + labelWidth, startY, {
      lineGap: 2,
      width: valueWidth
    });
  doc.x = margin;
  doc.y = startY + rowHeight + 7;
}

/** Renders a printable body paragraph. */
function paragraph(doc: PDFKit.PDFDocument, value: string) {
  const text = sanitizeText(value);
  ensureSpace(
    doc,
    Math.min(
      doc.heightOfString(text, { width: contentWidth(doc), lineGap: 3 }) + 10,
      180
    )
  );
  doc.fillColor(colors.ink).font("Helvetica").fontSize(10.5).text(text, margin, doc.y, {
    lineGap: 3,
    width: contentWidth(doc)
  });
  doc.moveDown(0.7);
}

/** Renders a titled block of evidence or timeline details. */
function itemBlock(
  doc: PDFKit.PDFDocument,
  title: string,
  lines: Array<string | null>
) {
  const bodyLines = lines.filter((line): line is string => Boolean(line));
  const body = bodyLines.map((line) => sanitizeText(line)).join("\n");
  const height =
    doc.heightOfString(sanitizeText(title), { width: contentWidth(doc) }) +
    doc.heightOfString(body, { width: contentWidth(doc) - 18, lineGap: 2 }) +
    26;

  ensureSpace(doc, Math.min(height, 180));
  doc
    .fillColor(colors.ink)
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .text(sanitizeText(title), margin, doc.y);

  if (body) {
    doc.moveDown(0.25);
    doc
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(9.5)
      .text(body, margin + 14, doc.y, {
        lineGap: 2,
        width: contentWidth(doc) - 14
      });
  }

  doc.moveDown(0.8);
}

/** Renders a compact printable bullet list. */
function bulletList(doc: PDFKit.PDFDocument, items: string[]) {
  for (const item of items) {
    const text = `- ${sanitizeText(item)}`;
    ensureSpace(
      doc,
      doc.heightOfString(text, { width: contentWidth(doc), lineGap: 2 }) + 5
    );
    doc.fillColor(colors.ink).font("Helvetica").fontSize(10.5).text(text, margin, doc.y, {
      lineGap: 2,
      width: contentWidth(doc)
    });
    doc.moveDown(0.25);
  }
  doc.moveDown(0.5);
}

/** Adds a page before a block would enter the reserved footer area. */
function ensureSpace(doc: PDFKit.PDFDocument, requiredHeight: number) {
  if (doc.y + requiredHeight > doc.page.height - bottomMargin) {
    doc.addPage();
  }
}

/** Returns the current page's printable content width. */
function contentWidth(doc: PDFKit.PDFDocument) {
  return doc.page.width - margin * 2;
}
