import {
  BellRing,
  BriefcaseBusiness,
  Clock3,
  FileArchive,
  ListChecks,
  PenLine,
  UploadCloud,
  type LucideIcon
} from "lucide-react";
import type { CaseActivityItem, CaseActivityItemCategory } from "@proofpilot/types";
import {
  formatActivityTime,
  getActivityBadgeVariant,
  getActivityCategoryLabel
} from "@/components/app/activity/activity-utils";
import { Badge } from "@/components/ui/badge";

const categoryIcons: Record<CaseActivityItemCategory, LucideIcon> = {
  case: BriefcaseBusiness,
  evidence: UploadCloud,
  timeline: Clock3,
  checklist: ListChecks,
  statement: PenLine,
  packet: FileArchive,
  reminder: BellRing
};

export function ActivityRow({ item }: { item: CaseActivityItem }) {
  const Icon = categoryIcons[item.category];

  return (
    <article className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 p-3 sm:grid-cols-[5rem_auto_minmax(0,1fr)_auto] sm:items-center sm:p-4">
      <time
        className="col-span-3 text-xs text-muted-foreground sm:col-span-1 sm:text-right sm:text-sm"
        dateTime={item.createdAt}
      >
        {formatActivityTime(item.createdAt)}
      </time>
      <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h5 className="break-words text-sm font-semibold text-foreground sm:text-base">
          {item.title}
        </h5>
        {item.detail ? (
          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground sm:text-sm">
            {item.detail}
          </p>
        ) : null}
      </div>
      <Badge className="justify-self-end" variant={getActivityBadgeVariant(item)}>
        {getActivityCategoryLabel(item.category)}
      </Badge>
    </article>
  );
}
