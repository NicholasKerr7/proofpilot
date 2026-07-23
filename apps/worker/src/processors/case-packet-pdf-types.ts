import type { PDFDocument as PdfLibDocument } from "pdf-lib";

export type PacketSupportingContentKind = "jpeg" | "pdf" | "png";

export interface PacketSupportingContent {
  bytes: Uint8Array;
  kind: PacketSupportingContentKind;
}

export interface PacketPdfChecklistItem {
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

export interface PacketPdfEvent {
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

export interface PacketPdfStatement {
  content: string;
  updatedAt: Date;
}

export interface PacketPdfCase {
  id: string;
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

export type PreparedInclusion =
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

export type PreparedPacketPdfDocument = PacketPdfDocument & {
  inclusion: PreparedInclusion;
};
