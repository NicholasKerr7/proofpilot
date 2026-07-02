import { z } from "zod";

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

export const createCaseSchema = z.object({
  title: z.string().min(3).max(160),
  platform: z.string().min(2).max(80),
  summary: z.string().max(2000).optional(),
  deadline: z.coerce.date().optional(),
  caseTypeSlug: z.string().min(2).max(80).default("account-ban-appeal")
});

export const updateCaseSchema = z.object({
  title: z.string().min(3).max(160).optional(),
  platform: z.string().min(2).max(80).optional(),
  summary: z.string().max(2000).nullable().optional(),
  deadline: z.coerce.date().nullable().optional(),
  status: z.enum(caseStatuses).optional()
});

export type CaseStatus = (typeof caseStatuses)[number];
export type DocumentStatus = (typeof documentStatuses)[number];
export type PacketStatus = (typeof packetStatuses)[number];
export type ChecklistStatus = (typeof checklistStatuses)[number];
export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;

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
