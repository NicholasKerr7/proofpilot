import {
  PDFDocument as PdfLibDocument,
  PDFName,
  StandardFonts,
  rgb
} from "pdf-lib";
import {
  joinPacketNotes,
  sanitizePacketText,
  truncatePacketText
} from "./case-packet-pdf-format.js";
import {
  a4PageSize,
  packetPdfMargin
} from "./case-packet-pdf-layout.js";
import type {
  PacketPdfCase,
  PacketPdfDocument,
  PreparedPacketPdfDocument
} from "./case-packet-pdf-types.js";

const maxAttachedPdfPages = 100;
const maxAttachedPages = 150;
const maxExtractedTextCharacters = 8_000;

/** Validates supporting content and selects attachment, text, or index inclusion. */
export async function preparePacketDocuments(documents: PacketPdfDocument[]) {
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

    const extractedText = sanitizePacketText(document.extractedText ?? "").slice(
      0,
      maxExtractedTextCharacters
    );

    if (extractedText) {
      preparedDocuments.push({
        ...document,
        inclusion: {
          kind: "text",
          note: joinPacketNotes(
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
        note: joinPacketNotes(
          "Indexed only; no renderable supporting content was available.",
          attachmentFailure,
          document.supportingNote ?? null
        )
      }
    });
  }

  return preparedDocuments;
}

/** Appends original evidence pages and stamps a unified footer across the final packet. */
export async function assembleCasePacket(
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

      // Strip active content and annotations from untrusted source pages.
      for (const page of pages) {
        page.node.delete(PDFName.of("AA"));
        page.node.delete(PDFName.of("Annots"));
        output.addPage(page);
        pageLabels.push(document.originalName);
      }
      continue;
    }

    const page = output.addPage([a4PageSize.width, a4PageSize.height]);
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

    page.drawText(
      truncatePacketText(sanitizePacketText(document.originalName), 78),
      {
        color: rgb(0.16, 0.15, 0.14),
        font: attachmentTitleFont,
        size: 11,
        x: packetPdfMargin,
        y: 734
      }
    );
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
    if (index === 0) {
      return;
    }

    const width = page.getWidth();
    const label = truncatePacketText(
      sanitizePacketText(pageLabels[index] ?? "ProofPilot case packet"),
      58
    );
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
      end: { x: width - packetPdfMargin, y: 26 },
      start: { x: packetPdfMargin, y: 26 },
      thickness: 0.5
    });
    page.drawText(label, {
      color: rgb(0.4, 0.37, 0.34),
      font: footerFont,
      size: 7.5,
      x: packetPdfMargin,
      y: 10
    });
    page.drawText(count, {
      color: rgb(0.4, 0.37, 0.34),
      font: footerFont,
      size: 7.5,
      x: width - packetPdfMargin - footerFont.widthOfTextAtSize(count, 7.5),
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
