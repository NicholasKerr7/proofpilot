import type { BillingUsage } from "@proofpilot/types";
import { FolderOpen, HardDrive, UploadCloud, UsersRound, type LucideIcon } from "lucide-react";
import {
  formatBillingStorage,
  getUsagePercent
} from "@/components/app/billing/billing-utils";
import { Progress } from "@/components/ui/progress";

interface BillingUsageHighlightsProps {
  usage: BillingUsage;
}

export function BillingUsageHighlights({ usage }: BillingUsageHighlightsProps) {
  const metrics: Array<{
    icon: LucideIcon;
    label: string;
    limit: number;
    value: string;
    used: number;
  }> = [
    {
      icon: FolderOpen,
      label: "Cases",
      limit: usage.cases.limit,
      used: usage.cases.used,
      value: `${usage.cases.used} / ${usage.cases.limit}`
    },
    {
      icon: HardDrive,
      label: "Storage",
      limit: usage.storage.limitBytes,
      used: usage.storage.usedBytes,
      value: `${formatBillingStorage(usage.storage.usedBytes)} / ${formatBillingStorage(usage.storage.limitBytes)}`
    },
    {
      icon: UploadCloud,
      label: "Uploads",
      limit: usage.uploads.limit,
      used: usage.uploads.used,
      value: `${usage.uploads.used} / ${usage.uploads.limit}`
    },
    {
      icon: UsersRound,
      label: "Team members",
      limit: usage.teamMembers.limit,
      used: usage.teamMembers.used,
      value: `${usage.teamMembers.used} / ${usage.teamMembers.limit}`
    }
  ];

  return (
    <section aria-labelledby="billing-usage-heading" className="rounded-md border border-border bg-card p-4 md:p-5">
      <h2 className="text-sm font-semibold uppercase text-primary" id="billing-usage-heading">
        Usage highlights
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const percent = getUsagePercent(metric.used, metric.limit);

          return (
            <div
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3 sm:even:border-r-0 lg:even:border-r lg:last:border-r-0"
              key={metric.label}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                <metric.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="break-words text-base font-semibold text-foreground">{metric.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{metric.label}</p>
                <Progress
                  ariaLabel={`${metric.label} ${percent}% used`}
                  className="mt-2"
                  value={percent}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
