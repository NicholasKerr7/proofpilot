import {
  FileText,
  ImageIcon,
  Mail,
  TableProperties,
  UploadCloud,
  type LucideIcon
} from "lucide-react";
import type { ReportEvidenceCategory } from "@proofpilot/types";

export const reportEvidenceIcons: Record<ReportEvidenceCategory, LucideIcon> = {
  images: ImageIcon,
  documents: FileText,
  emails: Mail,
  data: TableProperties,
  other: UploadCloud
};
