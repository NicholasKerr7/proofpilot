import type { SubmissionUpdateRecord } from "@proofpilot/types";
import {
  CheckCircle2,
  Clock3,
  FileQuestion,
  MessageSquareText,
  RadioTower,
  Send
} from "lucide-react";
import {
  formatSubmissionDate,
  formatSubmissionStatus,
  formatSubmissionUpdateType,
  getSubmissionStatusVariant
} from "@/components/app/submissions/submission-utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SubmissionHistoryProps {
  updates: SubmissionUpdateRecord[];
}

export function SubmissionHistory({ updates }: SubmissionHistoryProps) {
  return (
    <Card>
      <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center">
        <CardTitle>Submission history</CardTitle>
        <Badge variant="secondary">{updates.length} updates</Badge>
      </CardHeader>
      <CardContent>
        <ol className="grid">
          {updates.map((update, index) => {
            const UpdateIcon =
              update.type === "DECISION"
                ? CheckCircle2
                : update.type === "INFORMATION_REQUEST"
                  ? FileQuestion
                  : update.type === "FOLLOW_UP"
                    ? Send
                    : update.type === "ACKNOWLEDGEMENT"
                      ? RadioTower
                      : update.type === "NOTE"
                        ? MessageSquareText
                        : Clock3;

            return (
              <li
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-3"
                key={update.id}
              >
                <div className="grid grid-rows-[2.5rem_minmax(0,1fr)] justify-items-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                    <UpdateIcon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {index < updates.length - 1 ? (
                    <span
                      className="h-full w-px bg-border"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 pb-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">{update.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatSubmissionUpdateType(update.type)} ·{" "}
                        {formatSubmissionDate(update.occurredAt)}
                      </p>
                    </div>
                    {update.status ? (
                      <Badge variant={getSubmissionStatusVariant(update.status)}>
                        {formatSubmissionStatus(update.status)}
                      </Badge>
                    ) : null}
                  </div>
                  {update.details ? (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {update.details}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
