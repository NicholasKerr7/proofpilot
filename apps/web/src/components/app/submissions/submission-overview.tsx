import type { CaseSubmissionRecord } from "@proofpilot/types";
import {
  CalendarClock,
  Check,
  Circle,
  Clock3,
  Hash,
  RadioTower,
  Send
} from "lucide-react";
import {
  formatResponseCountdown,
  formatSubmissionChannel,
  formatSubmissionDate,
  formatSubmissionStatus,
  getSubmissionStage,
  getSubmissionStatusVariant
} from "@/components/app/submissions/submission-utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SubmissionOverviewProps {
  submission: CaseSubmissionRecord;
}

export function SubmissionOverview({ submission }: SubmissionOverviewProps) {
  const stage = getSubmissionStage(submission.status);
  const stages = [
    { icon: Send, label: "Submitted" },
    { icon: Check, label: "Received" },
    { icon: Clock3, label: "Review" },
    { icon: Circle, label: "Decision" }
  ];

  return (
    <Card className="proof-accent-frame">
      <CardContent className="grid gap-6 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">
              Appeal round {submission.round}
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {formatSubmissionStatus(submission.status)}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Submitted {formatSubmissionDate(submission.submittedAt)}
            </p>
          </div>
          <Badge variant={getSubmissionStatusVariant(submission.status)}>
            {["APPROVED", "CLOSED", "DENIED"].includes(submission.status)
              ? "Decision recorded"
              : formatResponseCountdown(submission.responseDueAt)}
          </Badge>
        </div>

        <ol
          aria-label="Submission progress"
          className="grid grid-cols-4 gap-1"
        >
          {stages.map((item, index) => {
            const isComplete = index + 1 <= stage;

            return (
              <li className="min-w-0" key={item.label}>
                <div
                  className={cn(
                    "h-1 rounded-full bg-secondary",
                    isComplete ? "bg-primary" : null
                  )}
                />
                <div
                  className={cn(
                    "mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs",
                    isComplete ? "text-foreground" : null
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isComplete ? "text-primary" : null
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </div>
              </li>
            );
          })}
        </ol>

        <dl className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
          <div className="bg-card px-4 py-4">
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
              <RadioTower className="h-4 w-4 text-primary" aria-hidden="true" />
              Channel
            </dt>
            <dd className="mt-2 text-sm font-semibold">
              {formatSubmissionChannel(submission.channel)}
            </dd>
            <dd className="mt-1 break-words text-xs text-muted-foreground">
              {submission.destination}
            </dd>
          </div>
          <div className="bg-card px-4 py-4">
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
              <Hash className="h-4 w-4 text-primary" aria-hidden="true" />
              Confirmation
            </dt>
            <dd className="mt-2 break-words font-mono text-sm font-semibold">
              {submission.confirmationCode ?? "Not recorded"}
            </dd>
          </div>
          <div className="bg-card px-4 py-4">
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
              Response deadline
            </dt>
            <dd className="mt-2 text-sm font-semibold">
              {submission.responseDueAt
                ? formatSubmissionDate(submission.responseDueAt)
                : "Not set"}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
