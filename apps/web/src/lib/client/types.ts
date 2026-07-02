export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface CaseType {
  id: string;
  slug: string;
  name: string;
  description: string;
}

export interface CaseRecord {
  id: string;
  title: string;
  platform: string;
  status: string;
  summary: string | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  caseType: CaseType;
  checklist?: ChecklistItem[];
  _count?: {
    documents: number;
    events: number;
    checklist: number;
    packets?: number;
  };
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
  downloadUrl: string;
  entities: EvidenceDocumentEntity[];
  processingLogs: EvidenceProcessingLog[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  status: string;
  updatedAt: string;
}

export interface CreateCasePayload {
  title: string;
  platform: string;
  summary?: string;
  deadline?: string;
  caseTypeSlug: string;
}
