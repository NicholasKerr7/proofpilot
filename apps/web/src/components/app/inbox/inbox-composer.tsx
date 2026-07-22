"use client";

import { type FormEvent, useState } from "react";
import type {
  CreateSupportRequestPayload,
  SupportRequestPriority,
  SupportRequestRecord
} from "@proofpilot/types";
import { ArrowLeft, Headphones, LoaderCircle, Send } from "lucide-react";
import {
  supportCategoryOptions,
  supportPriorityOptions
} from "@/components/app/help/support-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord } from "@/lib/client/types";

interface InboxComposerProps {
  cases: CaseRecord[];
  initialCaseId: string | null;
  onCancel: () => void;
  onCreated: (request: SupportRequestRecord) => void;
}

export function InboxComposer({
  cases,
  initialCaseId,
  onCancel,
  onCreated
}: InboxComposerProps) {
  const [caseId, setCaseId] = useState(initialCaseId ?? "");
  const [category, setCategory] = useState<CreateSupportRequestPayload["category"]>(
    "CASE_ASSISTANCE"
  );
  const [priority, setPriority] = useState<SupportRequestPriority>("NORMAL");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedSubject = subject.trim();
    const normalizedMessage = message.trim();

    if (normalizedSubject.length < 5 || normalizedMessage.length < 20) {
      setError("Enter a subject and at least 20 characters in the message.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const request = await apiRequest<SupportRequestRecord>("/api/support/requests", {
        body: JSON.stringify({
          ...(caseId ? { caseId } : {}),
          category,
          message: normalizedMessage,
          priority,
          subject: normalizedSubject
        } satisfies CreateSupportRequestPayload),
        method: "POST"
      });
      onCreated(request);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Message could not be sent."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="inbox-composer-heading"
      className="overflow-hidden border border-primary/35 bg-card"
    >
      <header className="flex items-start gap-3 border-b border-border px-4 py-4 sm:px-5">
        <Button
          aria-label="Close new message"
          onClick={onCancel}
          size="icon"
          title="Close new message"
          type="button"
          variant="ghost"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div>
          <p className="text-xs font-semibold uppercase text-primary">ProofPilot Support</p>
          <h2 className="mt-1 text-xl font-semibold" id="inbox-composer-heading">
            New message
          </h2>
        </div>
      </header>

      <form className="grid gap-5 p-4 sm:p-5" onSubmit={handleSubmit}>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border pb-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
            <Headphones className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">To</p>
            <p className="mt-1 text-sm font-semibold">ProofPilot Support</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="inbox-compose-case">Related case</Label>
            <Select
              id="inbox-compose-case"
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

          <div className="grid gap-2">
            <Label htmlFor="inbox-compose-category">Category</Label>
            <Select
              id="inbox-compose-category"
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
            <Label htmlFor="inbox-compose-priority">Priority</Label>
            <Select
              id="inbox-compose-priority"
              onChange={(event) =>
                setPriority(event.target.value as SupportRequestPriority)
              }
              value={priority}
            >
              {supportPriorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="inbox-compose-subject">Subject</Label>
            <Input
              autoFocus
              id="inbox-compose-subject"
              maxLength={160}
              minLength={5}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="What do you need help with?"
              required
              value={subject}
            />
          </div>

          <div className="grid gap-2 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="inbox-compose-message">Message</Label>
              <span className="text-xs text-muted-foreground">{message.length}/5000</span>
            </div>
            <Textarea
              className="min-h-44"
              id="inbox-compose-message"
              maxLength={5000}
              minLength={20}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe the question, relevant deadline, and what you have already tried."
              required
              value={message}
            />
          </div>
        </div>

        {error ? (
          <p
            className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            {isSubmitting ? "Sending..." : "Send message"}
          </Button>
        </div>
      </form>
    </section>
  );
}
