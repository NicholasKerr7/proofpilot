import { Clock3, Inbox, Tag } from "lucide-react";
import type { SupportRequestRecord } from "@proofpilot/types";
import {
  formatSupportDate,
  formatSupportRequestReference,
  getSupportCategoryLabel,
  supportStatusLabels
} from "@/components/app/help/support-utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SupportRequestHistoryProps {
  error: string | null;
  isLoading: boolean;
  onSelectRequest?: (requestId: string) => void;
  requests: SupportRequestRecord[];
  selectedRequestId?: string | null;
}

export function SupportRequestHistory({
  error,
  isLoading,
  onSelectRequest,
  requests,
  selectedRequestId = null
}: SupportRequestHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent requests</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading support history...</p>
        ) : error ? (
          <p className="text-sm text-red-200" role="alert">
            {error}
          </p>
        ) : requests.length ? (
          <div className="divide-y divide-border border-y border-border">
            {requests.slice(0, onSelectRequest ? 20 : 5).map((request) => {
              const content = (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-foreground">
                        {request.subject}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-primary">
                        {formatSupportRequestReference(request.id)}
                      </p>
                    </div>
                    <Badge variant={request.status === "RESOLVED" ? "success" : "secondary"}>
                      {supportStatusLabels[request.status]}
                    </Badge>
                  </div>
                  <div className="grid gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Tag aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                      {getSupportCategoryLabel(request.category)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock3 aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                      {formatSupportDate(request.updatedAt)}
                    </span>
                  </div>
                  {request.case ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      {request.case.platform}: {request.case.title}
                    </p>
                  ) : null}
                </>
              );

              return onSelectRequest ? (
                <button
                  aria-current={selectedRequestId === request.id ? "true" : undefined}
                  className={cn(
                    "grid w-full gap-3 p-3 text-left transition-colors hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    selectedRequestId === request.id ? "bg-primary/10" : null
                  )}
                  key={request.id}
                  onClick={() => onSelectRequest(request.id)}
                  type="button"
                >
                  {content}
                </button>
              ) : (
                <div className="grid gap-3 p-3" key={request.id}>
                  {content}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-36 place-items-center rounded-md border border-dashed border-border bg-secondary/20 p-4 text-center">
            <div>
              <Inbox aria-hidden="true" className="mx-auto h-5 w-5 text-primary" />
              <p className="mt-2 text-sm font-semibold">No support requests yet</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Submitted requests will appear here.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
