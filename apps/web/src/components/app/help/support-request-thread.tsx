"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Headphones,
  RefreshCcw,
  Send,
  ShieldCheck,
  UserRound
} from "lucide-react";
import type {
  SupportRequestDetailRecord,
  SupportRequestMessageRecord
} from "@proofpilot/types";
import {
  formatSupportDate,
  formatSupportRequestReference,
  getSupportCategoryLabel,
  supportStatusLabels
} from "@/components/app/help/support-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/client/api";
import { cn } from "@/lib/utils";

interface SupportRequestThreadProps {
  onRequestUpdated: (request: SupportRequestDetailRecord) => void;
  requestId: string;
}

type Notice = {
  tone: "error" | "success";
  text: string;
};

export function SupportRequestThread({
  onRequestUpdated,
  requestId
}: SupportRequestThreadProps) {
  const [request, setRequest] = useState<SupportRequestDetailRecord | null>(null);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadRequest() {
      setIsLoading(true);
      setNotice(null);

      try {
        const result = await apiRequest<SupportRequestDetailRecord>(
          `/api/support/requests/${requestId}`
        );

        if (isMounted) {
          setRequest(result);
        }
      } catch (error) {
        if (isMounted) {
          setRequest(null);
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Support request could not be loaded."
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadRequest();

    return () => {
      isMounted = false;
    };
  }, [requestId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!request || request.status === "RESOLVED") {
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      const createdMessage = await apiRequest<SupportRequestMessageRecord>(
        `/api/support/requests/${request.id}/messages`,
        {
          body: JSON.stringify({ message }),
          method: "POST"
        }
      );
      const nextRequest: SupportRequestDetailRecord = {
        ...request,
        messages: [...request.messages, createdMessage],
        updatedAt: createdMessage.createdAt
      };
      setRequest(nextRequest);
      setMessage("");
      setNotice({ tone: "success", text: "Follow-up added to the support request." });
      onRequestUpdated(nextRequest);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Follow-up could not be sent."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Card className="grid min-h-96 place-items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCcw aria-hidden="true" className="h-4 w-4" />
          Loading support request
        </div>
      </Card>
    );
  }

  if (!request) {
    return (
      <Card className="grid min-h-96 place-items-center p-6 text-center">
        <div>
          <Headphones aria-hidden="true" className="mx-auto h-6 w-6 text-primary" />
          <p className="mt-3 text-sm font-semibold">Request unavailable</p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            {notice?.text ?? "This support request could not be opened."}
          </p>
        </div>
      </Card>
    );
  }

  const isResolved = request.status === "RESOLVED";

  return (
    <Card aria-labelledby="support-thread-heading" className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={getSupportStatusVariant(request.status)}>
                {supportStatusLabels[request.status]}
              </Badge>
              <Badge variant="secondary">{getSupportCategoryLabel(request.category)}</Badge>
              <span className="font-mono text-[11px] text-primary">
                {formatSupportRequestReference(request.id)}
              </span>
            </div>
            <h2
              className="mt-3 break-words text-lg font-semibold leading-7 text-foreground"
              id="support-thread-heading"
            >
              {request.subject}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Updated {formatSupportDate(request.updatedAt)}
            </p>
          </div>
          <Badge variant="secondary">{formatPriority(request.priority)} priority</Badge>
        </div>

        {request.case ? (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-primary/30 bg-primary/10 p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/30 text-primary">
              <BriefcaseBusiness aria-hidden="true" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-foreground">
                {request.case.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{request.case.platform}</p>
            </div>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="grid p-0">
        <div
          aria-label="Support request messages"
          className="scroll-container grid gap-4 p-4 md:max-h-[40rem] md:overflow-y-auto sm:p-5"
        >
          <SupportMessageBubble
            author="USER"
            createdAt={request.createdAt}
            message={request.message}
          />

          <div className="mx-auto flex max-w-lg items-start gap-2 rounded-md border border-teal-400/25 bg-teal-400/10 px-3 py-2 text-xs leading-5 text-teal-100">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            Request received. Follow-ups stay attached to this reference and status changes appear in
            Inbox.
          </div>

          {request.messages.map((threadMessage) => (
            <SupportMessageBubble
              author={threadMessage.author}
              createdAt={threadMessage.createdAt}
              key={threadMessage.id}
              message={threadMessage.message}
            />
          ))}
        </div>

        <div className="border-t border-border p-4 sm:p-5">
          {notice ? (
            <p
              className={cn(
                "mb-4 rounded-md border px-3 py-2 text-sm",
                notice.tone === "success"
                  ? "border-teal-400/30 bg-teal-400/10 text-teal-100"
                  : "border-red-400/30 bg-red-400/10 text-red-100"
              )}
              role={notice.tone === "error" ? "alert" : "status"}
            >
              {notice.text}
            </p>
          ) : null}

          {isResolved ? (
            <p className="flex items-start gap-2 rounded-md border border-border bg-secondary/25 px-3 py-3 text-sm leading-6 text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-teal-200" />
              This request is resolved. Create a new request if another issue needs review.
            </p>
          ) : (
            <form aria-busy={isSubmitting} className="grid gap-3" onSubmit={handleSubmit}>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="support-follow-up">Add follow-up</Label>
                <span className="text-xs text-muted-foreground">{message.length}/5000</span>
              </div>
              <Textarea
                className="min-h-24"
                id="support-follow-up"
                maxLength={5000}
                minLength={2}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Add context, an error message, or a deadline."
                required
                value={message}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-muted-foreground">
                  Do not include passwords, security codes, or payment-card numbers.
                </p>
                <Button className="shrink-0" disabled={isSubmitting} type="submit">
                  <Send aria-hidden="true" className="h-4 w-4" />
                  {isSubmitting ? "Sending..." : "Send follow-up"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SupportMessageBubble({
  author,
  createdAt,
  message
}: Pick<SupportRequestMessageRecord, "author" | "createdAt" | "message">) {
  const isUser = author === "USER";
  const isSystem = author === "SYSTEM";

  if (isSystem) {
    return (
      <div className="mx-auto max-w-lg rounded-md border border-border bg-secondary/25 px-3 py-2 text-center">
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
          {message}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">{formatSupportDate(createdAt)}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className="grid max-w-[88%] grid-cols-[auto_minmax(0,1fr)] items-start gap-2 sm:max-w-[78%]">
        {!isUser ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-teal-400/30 bg-teal-400/10 text-teal-200">
            <Headphones aria-hidden="true" className="h-4 w-4" />
          </span>
        ) : null}
        <div
          className={cn(
            "rounded-md border px-3 py-2",
            isUser
              ? "border-primary/35 bg-primary/10"
              : "border-teal-400/25 bg-secondary/30"
          )}
        >
          <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            {isUser ? <UserRound aria-hidden="true" className="h-3.5 w-3.5 text-primary" /> : null}
            {isUser ? "You" : "ProofPilot Support"}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
            {message}
          </p>
          <p className="mt-2 text-right text-[11px] text-muted-foreground">
            {formatSupportDate(createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

function getSupportStatusVariant(status: SupportRequestDetailRecord["status"]) {
  if (status === "RESOLVED") {
    return "success" as const;
  }

  if (status === "IN_PROGRESS") {
    return "warning" as const;
  }

  return "secondary" as const;
}

function formatPriority(priority: SupportRequestDetailRecord["priority"]) {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}
