import { readFile } from "node:fs/promises";
import PDFDocument from "pdfkit";
import JSZip from "jszip";
import {
  csvMimeType,
  docxMimeType,
  emailMimeType,
  type EvidenceMimeType
} from "@proofpilot/types/evidence";
import type {
  GmailImportItem,
  GoogleDriveImportItem,
  ProviderImportItem,
  ProviderImportProvider
} from "@proofpilot/types";

interface GmailCatalogEntry extends GmailImportItem {
  body: string;
}

interface DriveCatalogEntry extends GoogleDriveImportItem {
  evidenceText: string;
}

const syntheticPassportItemId = "drive-identity-verification";
const syntheticPassportFixtureUrl = new URL(
  "./fixtures/synthetic-passport.png",
  import.meta.url
);

export interface MaterializedProviderImport {
  body: Buffer;
  mimeType: EvidenceMimeType;
  originalName: string;
}

const gmailCatalog: GmailCatalogEntry[] = [
  {
    body:
      "Hello Nicholas, PayPal has placed a permanent limitation on your account after a recent review. You can no longer use the account to send or receive payments.",
    id: "gmail-limitation-notice",
    kind: "EMAIL",
    mailbox: "Inbox",
    preview: "We've placed limitations on your account. Learn more about the review.",
    receivedAt: "2026-05-04T14:18:00.000Z",
    senderAddress: "service@paypal.com",
    senderName: "PayPal Support",
    sizeBytes: 734_003,
    subject: "Limitation notice from PayPal",
    unread: true
  },
  {
    body:
      "Thanks for contacting PayPal. Here is an update on case PP-2026-0147. Our account review team is evaluating the information you provided.",
    id: "gmail-support-follow-up",
    kind: "EMAIL",
    mailbox: "Inbox",
    preview: "Thanks for contacting PayPal. Here's an update on your case.",
    receivedAt: "2026-05-06T16:42:00.000Z",
    senderAddress: "support@paypal.com",
    senderName: "PayPal Support",
    sizeBytes: 660_603,
    subject: "Support follow-up",
    unread: true
  },
  {
    body:
      "We've closed your account permanently. You can no longer use PayPal services with this account. Any remaining balance will be reviewed separately.",
    id: "gmail-account-closure",
    kind: "EMAIL",
    mailbox: "Inbox",
    preview: "We've closed your account permanently. You can no longer use PayPal.",
    receivedAt: "2026-05-08T13:07:00.000Z",
    senderAddress: "service@paypal.com",
    senderName: "PayPal Support",
    sizeBytes: 838_861,
    subject: "Account closure email",
    unread: true
  },
  {
    body:
      "Please provide additional information to verify your identity, including a current photo ID and a recent statement showing your address.",
    id: "gmail-identity-confirmation",
    kind: "EMAIL",
    mailbox: "Inbox",
    preview: "Please provide additional information to verify your identity.",
    receivedAt: "2026-05-10T11:35:00.000Z",
    senderAddress: "support@paypal.com",
    senderName: "PayPal Support",
    sizeBytes: 702_546,
    subject: "Requested identity confirmation",
    unread: true
  },
  {
    body:
      "We've received your appeal request and will review it. We may contact you if the account review team needs more information.",
    id: "gmail-appeal-confirmation",
    kind: "EMAIL",
    mailbox: "Inbox",
    preview: "We've received your appeal request and will review it.",
    receivedAt: "2026-05-12T15:22:00.000Z",
    senderAddress: "appeals@paypal.com",
    senderName: "PayPal Appeals",
    sizeBytes: 503_316,
    subject: "Appeal received confirmation",
    unread: false
  },
  {
    body:
      "Your case is still under review. We'll be in touch soon with either a decision or a request for additional evidence.",
    id: "gmail-case-update",
    kind: "EMAIL",
    mailbox: "Inbox",
    preview: "Your case is still under review. We'll be in touch soon.",
    receivedAt: "2026-05-14T18:10:00.000Z",
    senderAddress: "support@paypal.com",
    senderName: "PayPal Support",
    sizeBytes: 440_402,
    subject: "Case update",
    unread: false
  }
];

const driveCatalog: DriveCatalogEntry[] = [
  {
    evidenceText: "Folder containing screenshots collected for the account appeal.",
    id: "drive-screenshots-folder",
    kind: "FOLDER",
    mimeType: null,
    modifiedAt: "2026-05-16T17:25:00.000Z",
    name: "screenshots",
    ownerLabel: "by me",
    sizeBytes: null,
    source: "MY_DRIVE"
  },
  {
    evidenceText:
      "Bank statement for Nicholas Kerr, May 2026. The statement confirms the account holder name and address used for identity verification.",
    id: "drive-bank-statement",
    kind: "FILE",
    mimeType: "application/pdf",
    modifiedAt: "2026-05-14T16:40:00.000Z",
    name: "bank-statement.pdf",
    ownerLabel: "by me",
    sizeBytes: 2_516_582,
    source: "MY_DRIVE"
  },
  {
    evidenceText:
      "Synthetic passport identity page for Nicholas James Kerr. Generated demonstration evidence for case PP-2026-0147; it does not represent a real identity document.",
    id: syntheticPassportItemId,
    kind: "FILE",
    mimeType: "image/png",
    modifiedAt: "2026-05-14T15:15:00.000Z",
    name: "synthetic-passport.png",
    ownerLabel: "by me",
    sizeBytes: 2_513_852,
    source: "MY_DRIVE"
  },
  {
    evidenceText:
      "date,description,amount,status\n2026-05-01,PayPal transfer,248.00,Completed\n2026-05-03,Account withdrawal,75.50,Completed\n2026-05-04,Account limitation,0.00,Restricted\n",
    id: "drive-transaction-history",
    kind: "FILE",
    mimeType: csvMimeType,
    modifiedAt: "2026-05-13T20:08:00.000Z",
    name: "transaction-history.csv",
    ownerLabel: "by me",
    sizeBytes: 3_879_731,
    source: "MY_DRIVE"
  },
  {
    evidenceText:
      "Appeal draft for PayPal case PP-2026-0147. I am requesting a review of the permanent account limitation and have attached identity and transaction evidence.",
    id: "drive-appeal-draft",
    kind: "FILE",
    mimeType: docxMimeType,
    modifiedAt: "2026-05-12T19:34:00.000Z",
    name: "appeal-draft.docx",
    ownerLabel: "by me",
    sizeBytes: 1_258_291,
    source: "MY_DRIVE"
  },
  {
    evidenceText:
      "Communication log for PayPal support. May 4: limitation notice received. May 6: support follow-up. May 10: identity confirmation requested.",
    id: "drive-communication-log",
    kind: "FILE",
    mimeType: "application/pdf",
    modifiedAt: "2026-05-10T18:03:00.000Z",
    name: "communication-log.pdf",
    ownerLabel: "by me",
    sizeBytes: 911_360,
    source: "MY_DRIVE"
  },
  {
    evidenceText:
      "Screenshot of the PayPal account closure notice for case PP-2026-0147.",
    id: "drive-account-closure-screenshot",
    kind: "FILE",
    mimeType: "image/png",
    modifiedAt: "2026-05-09T12:11:00.000Z",
    name: "account-closure-screenshot.png",
    ownerLabel: "by me",
    sizeBytes: 466_944,
    source: "MY_DRIVE"
  },
  {
    evidenceText:
      "Appeal letter template. Describe the account action, explain legitimate account use, list support contacts, and request restoration or release of funds.",
    id: "drive-appeal-template",
    kind: "FILE",
    mimeType: docxMimeType,
    modifiedAt: "2026-05-08T10:46:00.000Z",
    name: "appeal-letter-template.docx",
    ownerLabel: "by me",
    sizeBytes: 79_872,
    source: "MY_DRIVE"
  }
];

export function getDemoProviderImportItems(
  provider: ProviderImportProvider
): ProviderImportItem[] {
  if (provider === "GMAIL") {
    return gmailCatalog.map((item) => ({
      id: item.id,
      kind: item.kind,
      mailbox: item.mailbox,
      preview: item.preview,
      receivedAt: item.receivedAt,
      senderAddress: item.senderAddress,
      senderName: item.senderName,
      sizeBytes: item.sizeBytes,
      subject: item.subject,
      unread: item.unread
    }));
  }

  return driveCatalog.map((item) => ({
    id: item.id,
    kind: item.kind,
    mimeType: item.mimeType,
    modifiedAt: item.modifiedAt,
    name: item.name,
    ownerLabel: item.ownerLabel,
    sizeBytes: item.sizeBytes,
    source: item.source
  }));
}

export async function materializeDemoProviderImport(
  provider: ProviderImportProvider,
  itemId: string
): Promise<MaterializedProviderImport | null> {
  if (provider === "GMAIL") {
    const item = gmailCatalog.find((candidate) => candidate.id === itemId);

    if (!item) {
      return null;
    }

    return {
      body: Buffer.from(createEmailExport(item), "utf8"),
      mimeType: emailMimeType,
      originalName: `${item.id.replace(/^gmail-/, "")}.eml`
    };
  }

  const item = driveCatalog.find((candidate) => candidate.id === itemId);

  if (!item || item.kind === "FOLDER" || !item.mimeType) {
    return null;
  }

  return {
    body: await createDriveEvidenceBytes(item),
    mimeType: item.mimeType as EvidenceMimeType,
    originalName: item.name
  };
}

function createEmailExport(item: GmailCatalogEntry) {
  const headers = [
    `From: ${item.senderName} <${item.senderAddress}>`,
    "To: Nicholas Kerr <nicholas.kerr@gmail.com>",
    `Subject: ${item.subject}`,
    `Date: ${new Date(item.receivedAt).toUTCString()}`,
    `Message-ID: <${item.id}@proofpilot.demo>`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit"
  ];

  return `${headers.join("\r\n")}\r\n\r\n${item.body}\r\n`;
}

async function createDriveEvidenceBytes(item: DriveCatalogEntry) {
  if (item.id === syntheticPassportItemId) {
    return readFile(syntheticPassportFixtureUrl);
  }

  if (item.mimeType === "application/pdf") {
    return createEvidencePdf(item.name, item.evidenceText);
  }

  if (item.mimeType === docxMimeType) {
    return createEvidenceDocx(item.evidenceText);
  }

  if (item.mimeType === "image/png") {
    return Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
      "base64"
    );
  }

  return Buffer.from(item.evidenceText, "utf8");
}

function createEvidencePdf(title: string, evidenceText: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const document = new PDFDocument({ margin: 54, size: "LETTER" });

    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.fillColor("#d95d18").font("Helvetica-Bold").fontSize(20).text("ProofPilot");
    document.moveDown(1).fillColor("#111827").fontSize(16).text(title);
    document.moveDown(1).font("Helvetica").fontSize(11).text(evidenceText, {
      lineGap: 4
    });
    document.end();
  });
}

async function createEvidenceDocx(evidenceText: string) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      "</Types>"
  );
  zip.folder("_rels")?.file(
    ".rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>"
  );
  zip.folder("word")?.file(
    "document.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      `<w:body><w:p><w:r><w:t>${escapeXml(evidenceText)}</w:t></w:r></w:p>` +
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>'
  );

  return zip.generateAsync({ type: "nodebuffer" });
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
