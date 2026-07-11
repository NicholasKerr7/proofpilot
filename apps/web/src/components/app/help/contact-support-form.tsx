"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, Plus, Send } from "lucide-react";
import type {
  CreateSupportRequestPayload,
  SupportRequestPriority,
  SupportRequestRecord
} from "@proofpilot/types";
import { SupportInformationAside } from "@/components/app/help/support-information-aside";
import { SupportRequestHistory } from "@/components/app/help/support-request-history";
import { SupportRequestThread } from "@/components/app/help/support-request-thread";
import {
  supportCategoryOptions,
  supportPriorityOptions
} from "@/components/app/help/support-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface ContactSupportFormProps {
  cases: CaseRecord[];
  initialCaseId: string | null;
  initialRequestId: string | null;
  onBack: () => void;
  onSupportRequestCreated: () => void;
}

export function ContactSupportForm({
  cases,
  initialCaseId,
  initialRequestId,
  onBack,
  onSupportRequestCreated
}: ContactSupportFormProps) {
  const [caseId, setCaseId] = useState(() =>
    initialCaseId && cases.some((caseRecord) => caseRecord.id === initialCaseId)
      ? initialCaseId
      : ""
  );
  const [category, setCategory] = useState<CreateSupportRequestPayload["category"]>(
    "CASE_ASSISTANCE"
  );
  const [priority, setPriority] = useState<SupportRequestPriority>("NORMAL");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [requests, setRequests] = useState<SupportRequestRecord[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(initialRequestId);
  const [requestHistoryError, setRequestHistoryError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedCase = useMemo(
    () => cases.find((caseRecord) => caseRecord.id === caseId) ?? null,
    [caseId, cases]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadRequests() {
      try {
        const result = await apiRequest<SupportRequestRecord[]>("/api/support/requests");

        if (isMounted) {
          setRequests((currentRequests) => mergeSupportRequests(currentRequests, result));
          setRequestHistoryError(null);
        }
      } catch (error) {
        if (isMounted) {
          setRequestHistoryError(
            error instanceof Error ? error.message : "Support history could not be loaded."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingRequests(false);
        }
      }
    }

    void loadRequests();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    const payload: CreateSupportRequestPayload = {
      ...(caseId ? { caseId } : {}),
      category,
      subject,
      message,
      priority
    };

    try {
      const request = await apiRequest<SupportRequestRecord>("/api/support/requests", {
        body: JSON.stringify(payload),
        method: "POST"
      });
      setRequests((currentRequests) => [
        request,
        ...currentRequests.filter((currentRequest) => currentRequest.id !== request.id)
      ]);
      setSubject("");
      setMessage("");
      setSelectedRequestId(request.id);
      onSupportRequestCreated();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Support request could not be sent.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="contact-support-heading" className="grid gap-5">
      <Button className="w-fit" onClick={onBack} type="button" variant="ghost">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to Help Center
      </Button>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Authenticated support</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl" id="contact-support-heading">
            {selectedRequestId ? "Support request" : "Contact support"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {selectedRequestId
              ? "Review the request history and add context without starting a duplicate ticket."
              : "Send a request from your private workspace and link the relevant case when applicable."}
          </p>
        </div>
        {selectedRequestId ? (
          <Button onClick={() => setSelectedRequestId(null)} type="button" variant="outline">
            <Plus aria-hidden="true" className="h-4 w-4" />
            New request
          </Button>
        ) : null}
      </div>

      {selectedRequestId ? (
        <div className="grid gap-5 md:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.28fr)] md:items-start">
          <div className="order-2 md:order-1">
            <SupportRequestHistory
              error={requestHistoryError}
              isLoading={isLoadingRequests}
              onSelectRequest={setSelectedRequestId}
              requests={requests}
              selectedRequestId={selectedRequestId}
            />
          </div>
          <div className="order-1 min-w-0 md:order-2">
            <SupportRequestThread
              key={selectedRequestId}
              onRequestUpdated={(updatedRequest) => {
                setRequests((currentRequests) => [
                  updatedRequest,
                  ...currentRequests.filter(
                    (currentRequest) => currentRequest.id !== updatedRequest.id
                  )
                ]);
                onSupportRequestCreated();
              }}
              requestId={selectedRequestId}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.75fr)] md:items-start">
          <form className="grid gap-5" onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>Request details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="support-case">Related case</Label>
                  <Select
                    className="min-h-12"
                    id="support-case"
                    onChange={(event) => setCaseId(event.target.value)}
                    value={caseId}
                  >
                    <option value="">No case selected</option>
                    {cases.map((caseRecord) => (
                      <option key={caseRecord.id} value={caseRecord.id}>
                        {caseRecord.title}
                      </option>
                    ))}
                  </Select>
                </div>

                {selectedCase ? (
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-md border border-primary/35 bg-primary/10 p-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/35 text-primary">
                      <BriefcaseBusiness aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">{selectedCase.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedCase.platform}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="support-category">Category</Label>
                    <Select
                      className="min-h-12"
                      id="support-category"
                      onChange={(event) =>
                        setCategory(event.target.value as CreateSupportRequestPayload["category"])
                      }
                      value={category}
                    >
                      {supportCategoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="support-subject">Subject</Label>
                    <Input
                      className="min-h-12"
                      id="support-subject"
                      maxLength={160}
                      minLength={5}
                      onChange={(event) => setSubject(event.target.value)}
                      placeholder="What do you need help with?"
                      required
                      value={subject}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="support-message">Message</Label>
                    <span className="text-xs text-muted-foreground">{message.length}/5000</span>
                  </div>
                  <Textarea
                    className="min-h-44"
                    id="support-message"
                    maxLength={5000}
                    minLength={20}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Describe the issue, what you expected, and any deadline involved."
                    required
                    value={message}
                  />
                </div>

                <fieldset className="grid gap-2">
                  <legend className="text-sm font-medium text-foreground">Priority</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {supportPriorityOptions.map((option) => (
                      <button
                        aria-pressed={priority === option.value}
                        className={cn(
                          "grid min-h-16 content-center rounded-md border px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          priority === option.value
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-secondary/20 text-muted-foreground"
                        )}
                        key={option.value}
                        onClick={() => setPriority(option.value)}
                        type="button"
                      >
                        <span className="text-sm font-semibold">{option.label}</span>
                        <span className="mt-1 text-[11px]">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                {submitError ? (
                  <p
                    className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
                    role="alert"
                  >
                    {submitError}
                  </p>
                ) : null}

                <Button disabled={isSubmitting} size="lg" type="submit">
                  <Send aria-hidden="true" className="h-5 w-5" />
                  {isSubmitting ? "Sending request..." : "Send support request"}
                </Button>
              </CardContent>
            </Card>
          </form>

          <SupportInformationAside
            historyError={requestHistoryError}
            isLoadingRequests={isLoadingRequests}
            onSelectRequest={setSelectedRequestId}
            requests={requests}
            selectedRequestId={selectedRequestId}
          />
        </div>
      )}
    </section>
  );
}

function mergeSupportRequests(
  currentRequests: SupportRequestRecord[],
  loadedRequests: SupportRequestRecord[]
) {
  const requestsById = new Map(
    [...loadedRequests, ...currentRequests].map((request) => [request.id, request] as const)
  );

  return Array.from(requestsById.values()).sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  );
}
