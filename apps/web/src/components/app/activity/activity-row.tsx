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
    <article className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 p-3 md:grid-cols-[4.5rem_1.25rem_2.75rem_minmax(0,1fr)_auto] md:items-center md:px-4 md:py-3">
      <time
        className="col-span-2 text-xs text-muted-foreground md:col-span-1 md:text-right md:text-sm"
        dateTime={item.createdAt}
      >
        {formatActivityTime(item.createdAt)}
      </time>
      <span
        aria-hidden="true"
        className="relative hidden min-h-14 self-stretch md:flex md:items-center md:justify-center"
      >
        <span className="absolute inset-y-[-0.75rem] left-1/2 w-px -translate-x-1/2 bg-border" />
        <span className="relative z-10 h-3 w-3 rounded-full border-2 border-primary bg-card ring-4 ring-primary/10" />
      </span>
      <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h5 className="break-words text-sm font-semibold text-foreground md:text-base">
          {item.title}
        </h5>
        {item.detail ? (
          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground md:text-sm">
            {item.detail}
          </p>
        ) : null}
      </div>
      <Badge
        className="col-start-2 justify-self-start md:col-start-auto md:justify-self-end"
        variant={getActivityBadgeVariant(item)}
      >
        {getActivityCategoryLabel(item.category)}
      </Badge>
    </article>
  );
}
