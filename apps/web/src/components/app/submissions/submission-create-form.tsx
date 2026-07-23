"use client";

import {
  appealSubmissionChannels,
  type CreateCaseSubmissionInput
} from "@proofpilot/types";
import { type FormEvent, useState } from "react";
import { Send, X } from "lucide-react";
import {
  formatSubmissionChannel,
  toLocalDateTimeInput
} from "@/components/app/submissions/submission-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SubmissionCreateFormProps {
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateCaseSubmissionInput) => Promise<boolean>;
  round: number;
}

export function SubmissionCreateForm({
  isSubmitting,
  onCancel,
  onSubmit,
  round
}: SubmissionCreateFormProps) {
  const now = new Date();
  const defaultResponseDate = new Date(now.getTime() + 14 * 86_400_000);
  const [channel, setChannel] =
    useState<CreateCaseSubmissionInput["channel"]>("WEB_PORTAL");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [destination, setDestination] = useState("PayPal Resolution Center");
  const [notes, setNotes] = useState("");
  const [responseDueAt, setResponseDueAt] = useState(
    toLocalDateTimeInput(defaultResponseDate)
  );
  const [submittedAt, setSubmittedAt] = useState(toLocalDateTimeInput(now));
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedDate = new Date(submittedAt);
    const responseDate = responseDueAt ? new Date(responseDueAt) : null;

    if (!destination.trim()) {
      setValidationMessage("Enter the platform or team that received the appeal.");
      return;
    }

    if (Number.isNaN(submittedDate.getTime())) {
      setValidationMessage("Choose a valid submission date.");
      return;
    }

    if (
      responseDate &&
      (Number.isNaN(responseDate.getTime()) || responseDate <= submittedDate)
    ) {
      setValidationMessage("Choose a response deadline after the submission date.");
      return;
    }

    setValidationMessage(null);
    const wasSaved = await onSubmit({
      channel,
      destination: destination.trim(),
      submittedAt: submittedDate.toISOString(),
      ...(confirmationCode.trim()
        ? { confirmationCode: confirmationCode.trim() }
        : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(responseDate ? { responseDueAt: responseDate.toISOString() } : {})
    });

    if (wasSaved) {
      onCancel();
    }
  }

  return (
    <Card className="border-primary/35">
      <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">
            Appeal round {round}
          </p>
          <CardTitle className="mt-1">Record submission</CardTitle>
        </div>
        <Button
          aria-label="Close submission form"
          disabled={isSubmitting}
          onClick={onCancel}
          size="icon"
          title="Close submission form"
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          {validationMessage ? (
            <p
              className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
              role="alert"
            >
              {validationMessage}
            </p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`submission-channel-${round}`}>Channel</Label>
              <select
                className="min-h-11 rounded-md border border-input bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                id={`submission-channel-${round}`}
                onChange={(event) =>
                  setChannel(
                    event.target.value as CreateCaseSubmissionInput["channel"]
                  )
                }
                value={channel}
              >
                {appealSubmissionChannels.map((option) => (
                  <option key={option} value={option}>
                    {formatSubmissionChannel(option)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`submission-destination-${round}`}>
                Destination
              </Label>
              <Input
                id={`submission-destination-${round}`}
                maxLength={160}
                onChange={(event) => setDestination(event.target.value)}
                placeholder="Platform appeals team"
                required
                value={destination}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`submission-date-${round}`}>Submitted</Label>
              <Input
                id={`submission-date-${round}`}
                onChange={(event) => setSubmittedAt(event.target.value)}
                required
                type="datetime-local"
                value={submittedAt}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`submission-response-${round}`}>
                Response deadline
              </Label>
              <Input
                id={`submission-response-${round}`}
                onChange={(event) => setResponseDueAt(event.target.value)}
                type="datetime-local"
                value={responseDueAt}
              />
            </div>
            <div className="grid gap-1.5 md:col-span-2">
              <Label htmlFor={`submission-confirmation-${round}`}>
                Confirmation or reference number
              </Label>
              <Input
                id={`submission-confirmation-${round}`}
                maxLength={120}
                onChange={(event) => setConfirmationCode(event.target.value)}
                placeholder="Optional"
                value={confirmationCode}
              />
            </div>
            <div className="grid gap-1.5 md:col-span-2">
              <Label htmlFor={`submission-notes-${round}`}>Notes</Label>
              <Textarea
                id={`submission-notes-${round}`}
                maxLength={2000}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Record the form, email address, or instructions used."
                value={notes}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              disabled={isSubmitting}
              onClick={onCancel}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              <Send className="h-4 w-4" aria-hidden="true" />
              {isSubmitting ? "Recording..." : "Record submission"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
