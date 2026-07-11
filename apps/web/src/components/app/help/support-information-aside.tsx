import { CircleHelp, Inbox, ShieldCheck } from "lucide-react";
import type { SupportRequestRecord } from "@proofpilot/types";
import { SupportRequestHistory } from "@/components/app/help/support-request-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SupportInformationAsideProps {
  historyError: string | null;
  isLoadingRequests: boolean;
  onSelectRequest: (requestId: string) => void;
  requests: SupportRequestRecord[];
  selectedRequestId: string | null;
}

export function SupportInformationAside({
  historyError,
  isLoadingRequests,
  onSelectRequest,
  requests,
  selectedRequestId
}: SupportInformationAsideProps) {
  return (
    <aside className="grid gap-4" aria-label="Support request information">
      <Card className="border-primary/45">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox aria-hidden="true" className="h-5 w-5 text-primary" />
            Request handling
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
          <p>Your request is stored in this workspace and starts with Received status.</p>
          <p>ProofPilot adds a receipt to Inbox and keeps the request in your recent history.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="h-5 w-5 text-primary" />
            Before sending
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {[
            "Select the related case when the question concerns an appeal.",
            "Include dates, file names, or error text that helps identify the issue.",
            "Do not send passwords, security codes, or full payment-card numbers."
          ].map((tip) => (
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 text-sm" key={tip}>
              <CircleHelp aria-hidden="true" className="mt-1 h-4 w-4 text-primary" />
              <span className="leading-6 text-muted-foreground">{tip}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <SupportRequestHistory
        error={historyError}
        isLoading={isLoadingRequests}
        onSelectRequest={onSelectRequest}
        requests={requests}
        selectedRequestId={selectedRequestId}
      />
    </aside>
  );
}
