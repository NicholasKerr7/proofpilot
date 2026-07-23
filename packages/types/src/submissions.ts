export const appealSubmissionChannels = [
  "WEB_PORTAL",
  "EMAIL",
  "SUPPORT_CHAT",
  "MAIL",
  "FAX",
  "OTHER"
] as const;

export const appealSubmissionStatuses = [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "UNDER_REVIEW",
  "ACTION_REQUIRED",
  "APPROVED",
  "DENIED",
  "CLOSED"
] as const;

export const submissionUpdateTypes = [
  "ACKNOWLEDGEMENT",
  "STATUS_CHANGE",
  "INFORMATION_REQUEST",
  "FOLLOW_UP",
  "DECISION",
  "NOTE"
] as const;

export type AppealSubmissionChannel =
  (typeof appealSubmissionChannels)[number];
export type AppealSubmissionStatus =
  (typeof appealSubmissionStatuses)[number];
export type SubmissionUpdateType = (typeof submissionUpdateTypes)[number];

export interface SubmissionUpdateRecord {
  createdAt: string;
  details: string | null;
  id: string;
  occurredAt: string;
  status: AppealSubmissionStatus | null;
  submissionId: string;
  title: string;
  type: SubmissionUpdateType;
}

export interface CaseSubmissionRecord {
  caseId: string;
  channel: AppealSubmissionChannel;
  confirmationCode: string | null;
  createdAt: string;
  destination: string;
  id: string;
  notes: string | null;
  resolvedAt: string | null;
  responseDueAt: string | null;
  round: number;
  status: AppealSubmissionStatus;
  submittedAt: string;
  updatedAt: string;
  updates: SubmissionUpdateRecord[];
}

export interface CreateCaseSubmissionInput {
  channel: AppealSubmissionChannel;
  confirmationCode?: string;
  destination: string;
  notes?: string;
  responseDueAt?: string;
  submittedAt: string;
}

export interface CreateSubmissionUpdateInput {
  details?: string;
  occurredAt: string;
  responseDueAt?: string;
  status?: AppealSubmissionStatus;
  title: string;
  type: SubmissionUpdateType;
}
