import type { CaseAccess } from "@proofpilot/types";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface CaseType {
  id: string;
  slug: string;
  name: string;
  description: string;
}

export interface CaseRecord {
  access?: CaseAccess;
  id: string;
  title: string;
  platform: string;
  status: string;
  summary: string | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  caseType: CaseType;
  owner?: {
    email: string;
    name: string | null;
  };
  documentStats?: {
    failed: number;
    processed: number;
    total: number;
  };
  checklist?: ChecklistItem[];
  events?: CaseEvent[];
  _count?: {
    documents: number;
    events: number;
    checklist: number;
    statements?: number;
    packets?: number;
  };
}

export interface CaseEvent {
  id: string;
  sortOrder: number;
  occurredAt: string;
  title: string;
  description: string | null;
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
  sources: CaseEventSource[];
}

export interface CaseEventSource {
  id: string;
  document: {
    id: string;
    originalName: string;
  };
}

export interface TimelineEventPayload {
  occurredAt: string;
  title: string;
  description: string | null;
  documentIds: string[];
}

export interface EvidenceDocument {
  id: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentResponse {
  document: EvidenceDocument;
  upload: {
    method: "PUT";
    url: string;
    headers: Record<string, string>;
    expiresInSeconds: number;
  };
}

export interface EvidenceDocumentEntity {
  id: string;
  type: string;
  value: string;
  confidence: number | null;
  createdAt: string;
}

export interface EvidenceProcessingLog {
  id: string;
  step: string;
  status: string;
  message: string | null;
  createdAt: string;
}

export interface EvidenceDocumentDetail extends EvidenceDocument {
  caseId: string;
  extractedText: string | null;
  downloadUrl: string | null;
  quarantinedAt: string | null;
  entities: EvidenceDocumentEntity[];
  processingLogs: EvidenceProcessingLog[];
}

export interface EvidenceProcessingStatus {
  id: string;
  status: string;
  updatedAt: string;
  processingLogs: EvidenceProcessingLog[];
}

export interface ReprocessDocumentResponse {
  documentId: string;
  processingJob: {
    id: string | null;
    name: string;
  };
}

export interface CaseStatementVersion {
  id: string;
  content: string;
  version: number;
  createdAt: string;
}

export interface CaseStatement {
  id: string;
  caseId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  versions: CaseStatementVersion[];
}

export interface StatementGuidance {
  id: string;
  caseId: string;
  platformAction: string;
  actionDate: string;
  reasonGiven: string;
  accountUse: string;
  supportContact: string;
  requestedOutcome: string;
  supportingDocuments: string;
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

export interface CaseStatementResponse {
  statement: CaseStatement | null;
  guidance: StatementGuidance | null;
  summary: GeneratedCaseSummary | null;
  summaryHistory: GeneratedCaseSummary[];
}

export interface CasePacketExport {
  id: string;
  byteSize: number | null;
  pageCount: number | null;
  includedDocumentCount: number;
  indexedDocumentCount: number;
  createdAt: string;
  downloadUrl: string;
  previewUrl: string;
}

export interface CasePacket {
  id: string;
  caseId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  exports: CasePacketExport[];
}

export interface AppNotification {
  id: string;
  caseId: string | null;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  case: {
    id: string;
    platform: string;
    title: string;
  } | null;
}

export interface CaseReminder {
  id: string;
  caseId: string;
  remindAt: string;
  message: string;
  sentAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface WorkspaceReminder extends CaseReminder {
  case: {
    id: string;
    platform: string;
    title: string;
  };
}

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  isPlaceholder?: boolean;
  status: string;
  manuallyCompletedAt: string | null;
  updatedAt: string;
  matches?: ChecklistMatch[];
}

export interface ChecklistMatch {
  id: string;
  confidence: number;
  rationale: string | null;
  document: {
    id: string;
    originalName: string;
  };
}

export interface CreateCasePayload {
  title: string;
  platform: string;
  summary?: string;
  deadline?: string;
  caseTypeSlug: string;
}
