"use client";

import { type FormEvent, useState } from "react";
import { CalendarPlus, FileText, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  CaseEvent,
  EvidenceDocument,
  TimelineEventPayload
} from "@/lib/client/types";

interface TimelineEventComposerProps {
  documents: EvidenceDocument[];
  event?: CaseEvent;
  isLoadingDocuments: boolean;
  onCancel: () => void;
  onSubmit: (payload: TimelineEventPayload) => Promise<boolean>;
}

export function TimelineEventComposer({
  documents,
  event,
  isLoadingDocuments,
  onCancel,
  onSubmit
}: TimelineEventComposerProps) {
  const isEditing = Boolean(event);
  const [eventDate, setEventDate] = useState(() =>
    getDateInputValue(event ? new Date(event.occurredAt) : undefined)
  );
  const [eventTitle, setEventTitle] = useState(event?.title ?? "");
  const [eventDescription, setEventDescription] = useState(event?.description ?? "");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>(
    () => event?.sources.map((source) => source.document.id) ?? []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
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
      description: description || null,
      documentIds: selectedDocumentIds
    });

    setIsSubmitting(false);

    if (wasSaved) {
      onCancel();
    }
  }

  function toggleDocument(documentId: string, checked: boolean) {
    setSelectedDocumentIds((currentIds) =>
      checked
        ? [...currentIds, documentId]
        : currentIds.filter((currentId) => currentId !== documentId)
    );
  }

  return (
    <form
      className="grid gap-3 rounded-md border border-primary/30 bg-primary/10 p-3 md:p-4"
      id="timeline-event-editor"
      onSubmit={handleSubmit}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">
          {isEditing ? "Edit timeline event" : "Add timeline event"}
        </p>
        <Button
          aria-label={isEditing ? "Close event editor" : "Close event composer"}
          disabled={isSubmitting}
          onClick={onCancel}
          size="icon"
          title={isEditing ? "Close event editor" : "Close event composer"}
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
          <Label htmlFor={`timeline-event-date-${event?.id ?? "new"}`}>Date</Label>
          <Input
            id={`timeline-event-date-${event?.id ?? "new"}`}
            onChange={(inputEvent) => setEventDate(inputEvent.target.value)}
            required
            type="date"
            value={eventDate}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`timeline-event-title-${event?.id ?? "new"}`}>Event</Label>
          <Input
            id={`timeline-event-title-${event?.id ?? "new"}`}
            maxLength={160}
            onChange={(inputEvent) => setEventTitle(inputEvent.target.value)}
            placeholder="Account closure notice received"
            required
            value={eventTitle}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`timeline-event-description-${event?.id ?? "new"}`}>Details</Label>
        <Textarea
          id={`timeline-event-description-${event?.id ?? "new"}`}
          maxLength={2000}
          onChange={(inputEvent) => setEventDescription(inputEvent.target.value)}
          placeholder="Add the context needed for the appeal packet."
          value={eventDescription}
        />
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-foreground">Source evidence</legend>
        {isLoadingDocuments ? (
          <p className="rounded-md border border-border bg-background/35 px-3 py-3 text-sm text-muted-foreground" role="status">
            Loading evidence...
          </p>
        ) : documents.length ? (
          <div className="grid max-h-52 gap-1 overflow-y-auto rounded-md border border-border bg-background/35 p-1.5 sm:grid-cols-2">
            {documents.map((document) => {
              const isChecked = selectedDocumentIds.includes(document.id);

              return (
                <label
                  key={document.id}
                  className="grid min-h-11 cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-secondary/60"
                >
                  <input
                    checked={isChecked}
                    className="h-4 w-4 accent-primary"
                    onChange={(inputEvent) =>
                      toggleDocument(document.id, inputEvent.target.checked)
                    }
                    type="checkbox"
                  />
                  <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="truncate" title={document.originalName}>
                    {document.originalName}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border bg-background/35 px-3 py-3 text-sm text-muted-foreground">
            No case evidence available.
          </p>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={isSubmitting} type="submit">
          {isEditing ? (
            <Save className="h-4 w-4" aria-hidden="true" />
          ) : (
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          )}
          {isSubmitting ? "Saving..." : isEditing ? "Save event" : "Add event"}
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
