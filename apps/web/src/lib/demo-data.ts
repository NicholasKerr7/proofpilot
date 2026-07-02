import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  FolderOpen,
  ShieldCheck,
  UploadCloud
} from "lucide-react";

export const navItems = [
  { label: "Dashboard", icon: FolderOpen },
  { label: "Evidence", icon: UploadCloud },
  { label: "Timeline", icon: Clock3 },
  { label: "Packet", icon: FileCheck2 }
];

export const caseCards = [
  {
    title: "PayPal account closure appeal",
    platform: "PayPal",
    status: "Collecting evidence",
    progress: 64,
    due: "Jul 20",
    evidence: 8,
    gaps: 3
  },
  {
    title: "Cash App restriction review",
    platform: "Cash App",
    status: "Needs review",
    progress: 42,
    due: "Aug 2",
    evidence: 4,
    gaps: 5
  }
];

export const metrics = [
  { label: "Open cases", value: "2", detail: "1 ready for evidence", icon: FolderOpen },
  { label: "Evidence files", value: "12", detail: "3 need review", icon: FileText },
  { label: "Missing proof", value: "8", detail: "6 required items", icon: AlertTriangle },
  { label: "Packet status", value: "64%", detail: "Draft packet readiness", icon: ShieldCheck }
];

export const timeline = [
  {
    date: "Jun 12",
    title: "Account limitation notice received",
    source: "closure-notice.png",
    confidence: "High"
  },
  {
    date: "Jun 14",
    title: "Support ticket opened with platform",
    source: "support-thread.pdf",
    confidence: "Medium"
  },
  {
    date: "Jun 19",
    title: "Request for ownership verification",
    source: "email-export.txt",
    confidence: "High"
  }
];

export const checklist = [
  {
    label: "Closure screenshot",
    status: "Found",
    tone: "success",
    icon: CheckCircle2
  },
  {
    label: "Support conversation",
    status: "Found",
    tone: "success",
    icon: CheckCircle2
  },
  {
    label: "Account ownership proof",
    status: "Missing",
    tone: "warning",
    icon: AlertTriangle
  },
  {
    label: "Transaction context",
    status: "Needs review",
    tone: "review",
    icon: Clock3
  }
];
