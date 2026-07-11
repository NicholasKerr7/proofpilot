export const caseActivityCategories = [
  "all",
  "case",
  "evidence",
  "timeline",
  "checklist",
  "statement",
  "packet",
  "reminder"
] as const;

export type CaseActivityCategory = (typeof caseActivityCategories)[number];
export type CaseActivityItemCategory = Exclude<CaseActivityCategory, "all">;

export interface CaseActivityItem {
  id: string;
  action: string;
  category: CaseActivityItemCategory;
  title: string;
  detail: string | null;
  createdAt: string;
}

export interface CaseActivityResponse {
  items: CaseActivityItem[];
  total: number;
  hasMore: boolean;
}
