import { z } from "zod";
import { sanitizeUserText } from "./text.js";

const singleLineUserText = z
  .string()
  .transform((value) => sanitizeUserText(value, { singleLine: true }));
const multilineUserText = z.string().transform((value) => sanitizeUserText(value));

export const caseStatuses = [
  "DRAFT",
  "COLLECTING_EVIDENCE",
  "PROCESSING",
  "NEEDS_MORE_EVIDENCE",
  "READY_FOR_REVIEW",
  "PACKET_GENERATED",
  "SUBMITTED",
  "RESOLVED",
  "ARCHIVED"
] as const;

export const documentStatuses = [
  "UPLOADED",
  "PROCESSING",
  "PROCESSED",
  "FAILED",
  "NEEDS_REVIEW"
] as const;

export const packetStatuses = [
  "NOT_STARTED",
  "GENERATING",
  "READY",
  "FAILED",
  "DOWNLOADED"
] as const;

export const checklistStatuses = [
  "MISSING",
  "FOUND",
  "NEEDS_REVIEW",
  "OPTIONAL",
  "COMPLETE"
] as const;

export interface CaseReferenceSource {
  createdAt: Date | string;
  id: string;
}

export function formatCaseReference(source: CaseReferenceSource) {
  const year = new Date(source.createdAt).getFullYear();
  const numericHash = Array.from(source.id).reduce(
    (hash, character) => (hash * 31 + character.charCodeAt(0)) % 10_000,
    0
  );

  return `PP-${year}-${String(numericHash).padStart(4, "0")}`;
}

export const createCaseSchema = z.object({
  title: singleLineUserText.pipe(z.string().min(3).max(160)),
  platform: singleLineUserText.pipe(z.string().min(2).max(80)),
  summary: multilineUserText.pipe(z.string().max(2000)).optional(),
  deadline: z.coerce.date().optional(),
  caseTypeSlug: z.string().min(2).max(80).default("account-ban-appeal")
});

export const updateCaseSchema = z.object({
  title: singleLineUserText.pipe(z.string().min(3).max(160)).optional(),
  platform: singleLineUserText.pipe(z.string().min(2).max(80)).optional(),
  summary: multilineUserText.pipe(z.string().max(2000)).nullable().optional(),
  deadline: z.coerce.date().nullable().optional(),
  status: z.enum(caseStatuses).optional()
});

export const saveStatementSchema = z.object({
  content: multilineUserText.pipe(z.string().min(1).max(12000))
});

export const statementGuidanceFields = [
  "platformAction",
  "actionDate",
  "reasonGiven",
  "accountUse",
  "supportContact",
  "requestedOutcome",
  "supportingDocuments"
] as const;

export const saveStatementGuidanceSchema = z.object({
  platformAction: multilineUserText.pipe(z.string().max(500)),
  actionDate: singleLineUserText.pipe(z.string().max(160)),
  reasonGiven: multilineUserText.pipe(z.string().max(2000)),
  accountUse: multilineUserText.pipe(z.string().max(2000)),
  supportContact: multilineUserText.pipe(z.string().max(2000)),
  requestedOutcome: multilineUserText.pipe(z.string().max(1200)),
  supportingDocuments: multilineUserText.pipe(z.string().max(2000))
});

export const createTimelineEventSchema = z.object({
  occurredAt: z.coerce.date(),
  title: singleLineUserText.pipe(z.string().min(3).max(160)),
  description: multilineUserText.pipe(z.string().max(2000)).optional()
});

export type CaseStatus = (typeof caseStatuses)[number];
export type DocumentStatus = (typeof documentStatuses)[number];
export type PacketStatus = (typeof packetStatuses)[number];
export type ChecklistStatus = (typeof checklistStatuses)[number];
export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type SaveStatementInput = z.infer<typeof saveStatementSchema>;
export type SaveStatementGuidanceInput = z.infer<typeof saveStatementGuidanceSchema>;
export type StatementGuidanceField = (typeof statementGuidanceFields)[number];
export type CreateTimelineEventInput = z.infer<typeof createTimelineEventSchema>;

export interface CaseSummary {
  id: string;
  title: string;
  platform: string;
  status: CaseStatus;
  summary: string | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatementVersionSummary {
  id: string;
  content: string;
  version: number;
  createdAt: string;
}

export interface CaseStatementSummary {
  id: string;
  caseId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  versions: StatementVersionSummary[];
}

export interface StatementGuidanceSummary extends SaveStatementGuidanceInput {
  id: string;
  caseId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedCaseSummary {
  id: string;
  caseId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatementWorkspaceSummary {
  statement: CaseStatementSummary | null;
  guidance: StatementGuidanceSummary | null;
  summary: GeneratedCaseSummary | null;
  summaryHistory: GeneratedCaseSummary[];
}

export interface PacketExportSummary {
  id: string;
  byteSize: number | null;
  pageCount: number | null;
  includedDocumentCount: number;
  indexedDocumentCount: number;
  createdAt: string;
  downloadUrl: string;
  previewUrl: string;
}

export interface CasePacketSummary {
  id: string;
  caseId: string;
  status: PacketStatus;
  createdAt: string;
  updatedAt: string;
  exports: PacketExportSummary[];
}
