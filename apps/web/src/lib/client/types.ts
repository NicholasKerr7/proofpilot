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
  _count?: {
    documents: number;
    events: number;
    checklist: number;
    packets?: number;
  };
}

export interface CreateCasePayload {
  title: string;
  platform: string;
  summary?: string;
  deadline?: string;
  caseTypeSlug: string;
}
