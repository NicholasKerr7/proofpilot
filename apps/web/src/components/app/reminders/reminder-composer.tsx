"use client";

import { type FormEvent, useState } from "react";
import { BellPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type CreateReminderInput = {
  message?: string;
  remindAt: string;
};

interface ReminderComposerProps {
  caseId: string;
  defaultRemindAt: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateReminderInput) => Promise<boolean>;
}

export function ReminderComposer({
  caseId,
  defaultRemindAt,
  isSubmitting,
  onCancel,
  onSubmit
}: ReminderComposerProps) {
  const [remindAt, setRemindAt] = useState(defaultRemindAt);
  const [message, setMessage] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedDate = new Date(remindAt);
    const trimmedMessage = message.trim();

    if (!remindAt || Number.isNaN(parsedDate.getTime())) {
      setValidationMessage("Choose a valid reminder date and time.");
      return;
    }

    if (parsedDate.getTime() <= Date.now()) {
      setValidationMessage("Choose a reminder time in the future.");
      return;
    }

    setValidationMessage(null);
    const wasSaved = await onSubmit({
      remindAt: parsedDate.toISOString(),
      ...(trimmedMessage ? { message: trimmedMessage } : {})
    });

    if (wasSaved) {
      setRemindAt(defaultRemindAt);
      setMessage("");
      onCancel();
    }
  }

  return (
    <form
      className="grid gap-3 rounded-md border border-primary/30 bg-primary/10 p-3 md:p-4"
      onSubmit={handleSubmit}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Add reminder</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Schedule an in-app prompt for this case.
          </p>
        </div>
        <Button
          aria-label="Close reminder composer"
          disabled={isSubmitting}
          onClick={onCancel}
          size="icon"
          title="Close reminder composer"
          type="button"
          variant="ghost"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {validationMessage ? (
        <p
          className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
          role="alert"
        >
          {validationMessage}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[minmax(12rem,0.6fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-1.5">
          <Label htmlFor={`reminder-at-${caseId}`}>Reminder time</Label>
          <Input
            id={`reminder-at-${caseId}`}
            onChange={(event) => setRemindAt(event.target.value)}
            required
            type="datetime-local"
            value={remindAt}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`reminder-message-${caseId}`}>Message</Label>
          <Textarea
            id={`reminder-message-${caseId}`}
            maxLength={500}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Review missing evidence before the platform deadline."
            value={message}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={isSubmitting} type="submit">
          <BellPlus className="h-4 w-4" aria-hidden="true" />
          {isSubmitting ? "Saving..." : "Save reminder"}
        </Button>
      </div>
    </form>
  );
}
