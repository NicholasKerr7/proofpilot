"use client";

import { type FormEvent, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CreateTimelineEventPayload } from "@/lib/client/types";

interface TimelineEventComposerProps {
  onCancel: () => void;
  onSubmit: (payload: CreateTimelineEventPayload) => Promise<boolean>;
}

export function TimelineEventComposer({ onCancel, onSubmit }: TimelineEventComposerProps) {
  const [eventDate, setEventDate] = useState(() => getDateInputValue());
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = eventTitle.trim();
    const description = eventDescription.trim();

    if (!eventDate) {
      setValidationMessage("Choose the event date before saving.");
      return;
    }

    if (!title) {
      setValidationMessage("Add a short event title before saving.");
      return;
    }

    setIsSubmitting(true);
    setValidationMessage(null);

    const wasSaved = await onSubmit({
      occurredAt: toTimelineIsoDate(eventDate),
      title,
      ...(description ? { description } : {})
    });

    setIsSubmitting(false);

    if (wasSaved) {
      setEventDate(getDateInputValue());
      setEventTitle("");
      setEventDescription("");
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
          <p className="text-sm font-semibold text-foreground">Add timeline event</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Record a date that will help explain the appeal chronology.
          </p>
        </div>
        <Button
          aria-label="Close event composer"
          disabled={isSubmitting}
          onClick={onCancel}
          size="icon"
          title="Close event composer"
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

      <div className="grid gap-3 md:grid-cols-[minmax(10rem,0.4fr)_minmax(0,1fr)]">
        <div className="grid gap-1.5">
          <Label htmlFor="timeline-event-date">Date</Label>
          <Input
            id="timeline-event-date"
            onChange={(event) => setEventDate(event.target.value)}
            required
            type="date"
            value={eventDate}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="timeline-event-title">Event</Label>
          <Input
            id="timeline-event-title"
            maxLength={160}
            onChange={(event) => setEventTitle(event.target.value)}
            placeholder="Account closure notice received"
            required
            value={eventTitle}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="timeline-event-description">Details</Label>
        <Textarea
          id="timeline-event-description"
          maxLength={2000}
          onChange={(event) => setEventDescription(event.target.value)}
          placeholder="Add the context needed for the appeal packet."
          value={eventDescription}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={isSubmitting} type="submit">
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          {isSubmitting ? "Adding..." : "Add event"}
        </Button>
      </div>
    </form>
  );
}

function getDateInputValue(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function toTimelineIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toISOString();
}
