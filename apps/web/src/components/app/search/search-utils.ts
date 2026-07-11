import {
  BriefcaseBusiness,
  Clock3,
  FileArchive,
  FileText,
  Headphones,
  ListChecks,
  PenLine,
  type LucideIcon
} from "lucide-react";
import type {
  GlobalSearchResultType,
  GlobalSearchSort,
  GlobalSearchStatusFilter
} from "@proofpilot/types";

export const searchTypeConfig: Record<
  GlobalSearchResultType,
  { label: string; pluralLabel: string; icon: LucideIcon }
> = {
  CASE: { label: "Case", pluralLabel: "Cases", icon: BriefcaseBusiness },
  DOCUMENT: { label: "Evidence", pluralLabel: "Evidence", icon: FileText },
  TIMELINE: { label: "Timeline", pluralLabel: "Timeline", icon: Clock3 },
  CHECKLIST: { label: "Checklist", pluralLabel: "Checklist", icon: ListChecks },
  STATEMENT: { label: "Statement", pluralLabel: "Statements", icon: PenLine },
  PACKET: { label: "Packet", pluralLabel: "Packets", icon: FileArchive },
  SUPPORT: { label: "Support", pluralLabel: "Support", icon: Headphones }
};

export const searchStatusOptions: Array<{
  description: string;
  label: string;
  value: GlobalSearchStatusFilter;
}> = [
  { label: "All states", value: "ALL", description: "No state filter" },
  { label: "Needs attention", value: "NEEDS_ATTENTION", description: "Missing or failed" },
  { label: "In progress", value: "IN_PROGRESS", description: "Active work" },
  { label: "Ready", value: "READY", description: "Ready for the next step" },
  { label: "Complete", value: "COMPLETE", description: "Submitted or resolved" }
];

export const searchSortOptions: Array<{ label: string; value: GlobalSearchSort }> = [
  { label: "Best match", value: "RELEVANCE" },
  { label: "Newest first", value: "NEWEST" },
  { label: "Oldest first", value: "OLDEST" }
];

export function formatSearchDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatSearchStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatSearchBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
