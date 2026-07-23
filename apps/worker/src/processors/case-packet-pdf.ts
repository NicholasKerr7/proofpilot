import {
  assembleCasePacket,
  preparePacketDocuments
} from "./case-packet-pdf-attachments.js";
import { generateBasePacketPdf } from "./case-packet-pdf-renderer.js";
import type {
  PacketPdfCase,
  PacketPdfResult
} from "./case-packet-pdf-types.js";

export type {
  PacketPdfCase,
  PacketPdfDocument,
  PacketPdfResult,
  PacketSupportingContent,
  PacketSupportingContentKind
} from "./case-packet-pdf-types.js";

/** Generates the authored report, appends safe evidence, and reports final packet metrics. */
export async function generateCasePacketPdf(
  input: PacketPdfCase
): Promise<PacketPdfResult> {
  const preparedDocuments = await preparePacketDocuments(input.documents);
  const baseBytes = await generateBasePacketPdf(input, preparedDocuments);
  const assembled = await assembleCasePacket(input, baseBytes, preparedDocuments);

  return {
    bytes: assembled.bytes,
    includedDocumentCount: preparedDocuments.filter(
      (document) => document.inclusion.kind !== "index"
    ).length,
    indexedDocumentCount: preparedDocuments.length,
    pageCount: assembled.pageCount
  };
}
