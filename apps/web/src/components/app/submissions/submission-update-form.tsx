"use client";

import {
  appealSubmissionStatuses,
  submissionUpdateTypes,
  type AppealSubmissionStatus,
  type CreateSubmissionUpdateInput,
  type SubmissionUpdateType
} from "@proofpilot/types";
import { type FormEvent, useState } from "react";
import { PlusCircle } from "lucide-react";
import {
  formatSubmissionStatus,
  formatSubmissionUpdateType,
  toLocalDateTimeInput
} from "@/components/app/submissions/submission-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SubmissionUpdateFormProps {
  isSubmitting: boolean;
  onSubmit: (input: CreateSubmissionUpdateInput) => Promise<boolean>;
  round: number;
}

export function SubmissionUpdateForm({
  isSubmitting,
  onSubmit,
  round
}: SubmissionUpdateFormProps) {
  const [details, setDetails] = useState("");
  const [occurredAt, setOccurredAt] = useState(
    toLocalDateTimeInput(new Date())
  );
  const [responseDueAt, setResponseDueAt] = useState("");
  const [status, setStatus] = useState<AppealSubmissionStatus | "">(
    "ACKNOWLEDGED"
  );
  const [title, setTitle] = useState("Appeal receipt confirmed");
  const [type, setType] =
    useState<SubmissionUpdateType>("ACKNOWLEDGEMENT");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  function handleTypeChange(nextType: SubmissionUpdateType) {
    const defaults = getUpdateDefaults(nextType);
    setType(nextType);
    setStatus(defaults.status);
    setTitle(defaults.title);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const occurredDate = new Date(occurredAt);
    const responseDate = responseDueAt ? new Date(responseDueAt) : null;

    if (!title.trim()) {
      setValidationMessage("Enter a short title for this update.");
      return;
    }

    if (Number.isNaN(occurredDate.getTime())) {
      setValidationMessage("Choose a valid update date.");
      return;
    }

    if (
      responseDate &&
      (Number.isNaN(responseDate.getTime()) || responseDate <= occurredDate)
    ) {
      setValidationMessage("Choose a response deadline after the update date.");
      return;
    }

    if (type === "DECISION" && !status) {
      setValidationMessage("Choose the decision outcome.");
      return;
    }

    setValidationMessage(null);
    const wasSaved = await onSubmit({
      occurredAt: occurredDate.toISOString(),
      title: title.trim(),
      type,
      ...(details.trim() ? { details: details.trim() } : {}),
      ...(responseDate ? { responseDueAt: responseDate.toISOString() } : {}),
      ...(status ? { status } : {})
    });

    if (wasSaved) {
      setDetails("");
      setResponseDueAt("");
      setOccurredAt(toLocalDateTimeInput(new Date()));
    }
  }

  const statusOptions =
    type === "DECISION"
      ? appealSubmissionStatuses.filter((option) =>
          ["APPROVED", "DENIED", "CLOSED"].includes(option)
        )
      : appealSubmissionStatuses;

  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-semibold uppercase text-primary">
          Appeal round {round}
        </p>
        <CardTitle>Record an update</CardTitle>
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

          <div className="grid gap-1.5">
            <Label htmlFor={`submission-update-type-${round}`}>Update type</Label>
            <select
              className="min-h-11 rounded-md border border-input bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              id={`submission-update-type-${round}`}
              onChange={(event) =>
                handleTypeChange(event.target.value as SubmissionUpdateType)
              }
              value={type}
            >
              {submissionUpdateTypes.map((option) => (
                <option key={option} value={option}>
                  {formatSubmissionUpdateType(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`submission-update-title-${round}`}>Title</Label>
            <Input
              id={`submission-update-title-${round}`}
              maxLength={160}
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`submission-update-date-${round}`}>Date</Label>
              <Input
                id={`submission-update-date-${round}`}
                onChange={(event) => setOccurredAt(event.target.value)}
                required
                type="datetime-local"
                value={occurredAt}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`submission-update-status-${round}`}>Status</Label>
              <select
                className="min-h-11 rounded-md border border-input bg-input px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                id={`submission-update-status-${round}`}
                onChange={(event) =>
                  setStatus(event.target.value as AppealSubmissionStatus | "")
                }
                value={status}
              >
                <option value="">No status change</option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatSubmissionStatus(option)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`submission-update-response-${round}`}>
              New response deadline
            </Label>
            <Input
              id={`submission-update-response-${round}`}
              onChange={(event) => setResponseDueAt(event.target.value)}
              type="datetime-local"
              value={responseDueAt}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`submission-update-details-${round}`}>Details</Label>
            <Textarea
              id={`submission-update-details-${round}`}
              maxLength={2000}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Record the response, requested documents, or follow-up sent."
              value={details}
            />
          </div>
          <Button disabled={isSubmitting} type="submit">
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            {isSubmitting ? "Saving..." : "Add update"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function getUpdateDefaults(type: SubmissionUpdateType): {
  status: AppealSubmissionStatus | "";
  title: string;
} {
  const defaults: Record<
    SubmissionUpdateType,
    { status: AppealSubmissionStatus | ""; title: string }
  > = {
    ACKNOWLEDGEMENT: {
      status: "ACKNOWLEDGED",
      title: "Appeal receipt confirmed"
    },
    DECISION: {
      status: "DENIED",
      title: "Decision received"
    },
    FOLLOW_UP: {
      status: "",
      title: "Follow-up sent"
    },
    INFORMATION_REQUEST: {
      status: "ACTION_REQUIRED",
      title: "Additional information requested"
    },
    NOTE: {
      status: "",
      title: "Submission note"
    },
    STATUS_CHANGE: {
      status: "UNDER_REVIEW",
      title: "Appeal moved to account review"
    }
  };

  return defaults[type];
}
