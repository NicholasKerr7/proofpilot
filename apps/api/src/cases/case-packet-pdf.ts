import PDFDocument from "pdfkit";

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

interface PacketPdfDocument {
  originalName: string;
  mimeType: string;
  byteSize: number;
  status: string;
  createdAt: Date;
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

const margin = 54;
const bottomMargin = 120;
const colors = {
  accent: "#bd6f3e",
  border: "#d7c4a2",
  champagne: "#bfae8a",
  graphite: "#2b2926",
  ink: "#1d1a17",
  muted: "#655f56",
  surface: "#fbf8f0"
};

export async function generateCasePacketPdf(input: PacketPdfCase) {
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

    renderPacket(doc, input);
    addPageFooters(doc);
    doc.end();
  });
}

function renderPacket(doc: PDFKit.PDFDocument, input: PacketPdfCase) {
  renderCoverPage(doc, input);
  doc.addPage();
  renderCaseSummary(doc, input);
  renderStatement(doc, input.statements[0]?.content ?? null);
  renderTimeline(doc, input.events);
  renderChecklist(doc, input.checklist);
  renderEvidenceIndex(doc, input.documents);
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

function renderEvidenceIndex(doc: PDFKit.PDFDocument, documents: PacketPdfDocument[]) {
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
      `Uploaded: ${formatDate(document.createdAt)}`
    ]);
  });
}

function renderNextSteps(doc: PDFKit.PDFDocument) {
  sectionTitle(doc, "6. Next Steps");
  bulletList(doc, [
    "Review the statement for accuracy before submitting it to the platform.",
    "Attach the generated packet and any requested raw evidence files.",
    "Keep a copy of support ticket IDs, submission confirmations, and response dates.",
    "Regenerate the packet after adding new evidence or revising the statement."
  ]);
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 58);
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
  const rowHeight = Math.max(
    doc.heightOfString(text, { width: valueWidth }),
    doc.currentLineHeight()
  );

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
  ensureSpace(doc, doc.heightOfString(text, { width: contentWidth(doc), lineGap: 3 }) + 10);
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

  ensureSpace(doc, height);
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

function addPageFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();

  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const footerLineY = doc.page.height - 95;
    const footerTextY = doc.page.height - 87;

    doc
      .moveTo(margin, footerLineY)
      .lineTo(doc.page.width - margin, footerLineY)
      .lineWidth(0.5)
      .strokeColor(colors.border)
      .stroke();
    doc
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(8)
      .text(`ProofPilot case packet - page ${index + 1} of ${range.count}`, margin, footerTextY, {
        align: "right",
        lineBreak: false,
        width: contentWidth(doc)
      });
  }
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
    .replace(/\r\n/g, "\n")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u2022/g, "-")
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
