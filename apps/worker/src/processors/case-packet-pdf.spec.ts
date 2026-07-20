import { PDFDocument as PdfLibDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { generateCasePacketPdf, type PacketPdfCase } from "./case-packet-pdf.js";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

describe("case packet PDF renderer", () => {
  it("assembles original evidence pages and extracted-text appendices", async () => {
    const sourcePdf = await PdfLibDocument.create();
    sourcePdf.addPage([300, 400]);
    const sourcePdfBytes = await sourcePdf.save();
    const packet = createPacket({
      documents: [
        {
          originalName: "platform-notice.pdf",
          mimeType: "application/pdf",
          byteSize: sourcePdfBytes.byteLength,
          status: "PROCESSED",
          createdAt: new Date("2026-01-01T12:00:00.000Z"),
          extractedText: "Platform notice",
          supportingContent: {
            bytes: sourcePdfBytes,
            kind: "pdf"
          }
        },
        {
          originalName: "support-response.txt",
          mimeType: "text/plain",
          byteSize: 28,
          status: "PROCESSED",
          createdAt: new Date("2026-01-02T12:00:00.000Z"),
          extractedText: "Support confirmed the appeal was received.",
          supportingContent: null
        },
        {
          originalName: "account-screen.png",
          mimeType: "image/png",
          byteSize: onePixelPng.byteLength,
          status: "PROCESSED",
          createdAt: new Date("2026-01-03T12:00:00.000Z"),
          extractedText: null,
          supportingContent: {
            bytes: onePixelPng,
            kind: "png"
          }
        }
      ]
    });

    const result = await generateCasePacketPdf(packet);
    const renderedPdf = await PdfLibDocument.load(result.bytes);

    expect(result.indexedDocumentCount).toBe(3);
    expect(result.includedDocumentCount).toBe(3);
    expect(result.pageCount).toBe(renderedPdf.getPageCount());
    expect(result.pageCount).toBeGreaterThanOrEqual(4);
    expect(result.bytes.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("falls back to extracted text when a visual source is invalid", async () => {
    const result = await generateCasePacketPdf(
      createPacket({
        documents: [
          {
            originalName: "damaged.pdf",
            mimeType: "application/pdf",
            byteSize: 9,
            status: "NEEDS_REVIEW",
            createdAt: new Date("2026-01-01T12:00:00.000Z"),
            extractedText: "Readable fallback text",
            supportingContent: {
              bytes: Buffer.from("not-a-pdf"),
              kind: "pdf"
            }
          }
        ]
      })
    );

    expect(result.indexedDocumentCount).toBe(1);
    expect(result.includedDocumentCount).toBe(1);
    expect(result.pageCount).toBeGreaterThanOrEqual(2);
  });
});

function createPacket(overrides: Partial<PacketPdfCase> = {}): PacketPdfCase {
  const timestamp = new Date("2026-01-01T12:00:00.000Z");

  return {
    title: "PayPal limitation appeal",
    platform: "PayPal",
    summary: "Account was limited after an automated review.",
    deadline: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    caseType: {
      name: "Account Ban / Appeal Builder"
    },
    owner: {
      email: "nicholas.kerr@proofpilot.test",
      name: "Nicholas Kerr"
    },
    checklist: [],
    documents: [],
    events: [],
    statements: [
      {
        content: "Please restore access after reviewing the attached evidence.",
        updatedAt: timestamp
      }
    ],
    ...overrides
  };
}
