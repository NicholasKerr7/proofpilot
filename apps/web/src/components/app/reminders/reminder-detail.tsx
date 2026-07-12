"use client";

import { type FormEvent, useState } from "react";
import {
  BellRing,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  RefreshCcw,
  RotateCcw,
  Trash2,
  X
} from "lucide-react";
import { formatCaseStatus, getCaseStatusVariant } from "@/components/app/cases/case-utils";
import { ReminderDeleteConfirmation } from "@/components/app/reminders/reminder-delete-confirmation";
import {
  formatReminderDateTime,
  formatReminderRelativeTime,
  formatReminderStatus,
  getReminderStatus,
  toDateTimeLocalValue,
  type ReminderStatus
} from "@/components/app/reminders/reminder-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CaseRecord, CaseReminder } from "@/lib/client/types";

export interface UpdateReminderInput {
  completed?: boolean;
  message?: string;
  remindAt?: string;
}

interface ReminderDetailProps {
  isDeleting: boolean;
  isPendingDelete: boolean;
  isUpdating: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  onRequestDelete: () => void;
  onUpdate: (input: UpdateReminderInput) => Promise<boolean>;
  reminder: CaseReminder;
  selectedCase: CaseRecord;
}

export function ReminderDetail({
  isDeleting,
  isPendingDelete,
  isUpdating,
  onCancelDelete,
  onConfirmDelete,
  onRequestDelete,
  onUpdate,
  reminder,
  selectedCase
}: ReminderDetailProps) {
  const [isRescheduling, setIsRescheduling] = useState(false);
  const status = getReminderStatus(reminder);

  return (
    <div className="grid gap-4 border-t border-border px-3 py-4 md:px-4 md:py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Reminder detail</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {getReminderStatusDescription(reminder, status)}
          </p>
        </div>
        <ReminderStatusBadge status={status} />
      </div>

      <dl className="grid gap-3 border-y border-border py-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReminderMetadata
          icon="schedule"
          label="Scheduled"
          value={formatReminderDateTime(reminder.remindAt)}
        />
        <ReminderMetadata
          icon="relative"
          label="Timing"
          value={formatReminderRelativeTime(reminder.remindAt)}
        />
        <ReminderMetadata
          icon="created"
          label="Created"
          value={formatReminderDateTime(reminder.createdAt)}
        />
        <ReminderMetadata
          icon="deadline"
          label="Case deadline"
          value={
            selectedCase.deadline
              ? formatReminderDateTime(selectedCase.deadline)
              : "No deadline set"
          }
        />
      </dl>

      <section
        aria-labelledby={`reminder-case-${reminder.id}`}
        className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-y border-border py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
          <BriefcaseBusiness aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Linked case</p>
          <p
            className="mt-1 break-words text-sm font-semibold text-foreground"
            id={`reminder-case-${reminder.id}`}
          >
            {selectedCase.title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{selectedCase.platform}</p>
        </div>
        <Badge
          className="col-span-2 justify-self-start sm:col-span-1 sm:justify-self-auto"
          variant={getCaseStatusVariant(selectedCase.status)}
        >
          {formatCaseStatus(selectedCase.status)}
        </Badge>
      </section>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Button
          disabled={isUpdating}
          onClick={() => {
            void onUpdate({ completed: status !== "completed" });
          }}
          type="button"
        >
          {status === "completed" ? (
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          )}
          {isUpdating
            ? "Updating..."
            : status === "completed"
              ? "Reopen reminder"
              : "Mark complete"}
        </Button>
        <Button
          aria-expanded={isRescheduling}
          disabled={isUpdating}
          onClick={() => setIsRescheduling((current) => !current)}
          type="button"
          variant="outline"
        >
          <RefreshCcw aria-hidden="true" className="h-4 w-4" />
          Reschedule
        </Button>
        <Button asChild variant="outline">
          <a href="#evidence-checklist">
            <ClipboardCheck aria-hidden="true" className="h-4 w-4" />
            Open checklist
          </a>
        </Button>
        <Button
          disabled={isDeleting || isUpdating}
          onClick={onRequestDelete}
          type="button"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          Remove
        </Button>
      </div>

      {isRescheduling ? (
        <ReminderRescheduleForm
          isUpdating={isUpdating}
          onCancel={() => setIsRescheduling(false)}
          onUpdate={async (input) => {
            const wasUpdated = await onUpdate(input);

            if (wasUpdated) {
              setIsRescheduling(false);
            }

            return wasUpdated;
          }}
          reminder={reminder}
        />
      ) : null}

      {isPendingDelete ? (
        <ReminderDeleteConfirmation
          isDeleting={isDeleting}
          onCancel={onCancelDelete}
          onConfirm={onConfirmDelete}
        />
      ) : null}
    </div>
  );
}

function ReminderRescheduleForm({
  isUpdating,
  onCancel,
  onUpdate,
  reminder
}: {
  isUpdating: boolean;
  onCancel: () => void;
  onUpdate: (input: UpdateReminderInput) => Promise<boolean>;
  reminder: CaseReminder;
}) {
  const [remindAt, setRemindAt] = useState(() =>
    toDateTimeLocalValue(new Date(reminder.remindAt))
  );
  const [message, setMessage] = useState(reminder.message);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedDate = new Date(remindAt);
    const trimmedMessage = message.trim();

    if (!remindAt || Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() <= Date.now()) {
      setValidationMessage("Choose a valid future date and time.");
      return;
    }

    if (!trimmedMessage) {
      setValidationMessage("Enter a reminder message.");
      return;
    }

    setValidationMessage(null);
    await onUpdate({
      remindAt: parsedDate.toISOString(),
      message: trimmedMessage
    });
  }

  return (
    <form
      aria-busy={isUpdating}
      className="grid gap-3 border-y border-primary/30 bg-primary/10 px-3 py-4"
      onSubmit={handleSubmit}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Reschedule reminder</p>
          <p className="mt-1 text-xs text-muted-foreground">Update the prompt time or message.</p>
        </div>
        <Button
          aria-label="Close reschedule form"
          disabled={isUpdating}
          onClick={onCancel}
          size="icon"
          title="Close reschedule form"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" className="h-4 w-4" />
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
          <Label htmlFor={`reschedule-at-${reminder.id}`}>Reminder time</Label>
          <Input
            id={`reschedule-at-${reminder.id}`}
            onChange={(event) => setRemindAt(event.target.value)}
            required
            type="datetime-local"
            value={remindAt}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`reschedule-message-${reminder.id}`}>Message</Label>
          <Textarea
            id={`reschedule-message-${reminder.id}`}
            maxLength={500}
            onChange={(event) => setMessage(event.target.value)}
            required
            value={message}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button disabled={isUpdating} onClick={onCancel} type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={isUpdating} type="submit">
          <CalendarClock aria-hidden="true" className="h-4 w-4" />
          {isUpdating ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function ReminderMetadata({
  icon,
  label,
  value
}: {
  icon: "schedule" | "relative" | "created" | "deadline";
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 text-xs">
      <span className="pt-0.5 text-primary">
        {icon === "schedule" ? <BellRing aria-hidden="true" className="h-4 w-4" /> : null}
        {icon === "relative" ? <CalendarClock aria-hidden="true" className="h-4 w-4" /> : null}
        {icon === "created" ? <Clock3 aria-hidden="true" className="h-4 w-4" /> : null}
        {icon === "deadline" ? <BriefcaseBusiness aria-hidden="true" className="h-4 w-4" /> : null}
      </span>
      <span>
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="mt-1 font-medium leading-5 text-foreground">{value}</dd>
      </span>
    </div>
  );
}

function ReminderStatusBadge({ status }: { status: ReminderStatus }) {
  const variants = {
    completed: "success",
    sent: "secondary",
    overdue: "danger",
    upcoming: "warning"
  } as const;

  return <Badge variant={variants[status]}>{formatReminderStatus(status)}</Badge>;
}

function getReminderStatusDescription(reminder: CaseReminder, status: ReminderStatus) {
  if (status === "completed" && reminder.completedAt) {
    return `Completed ${formatReminderDateTime(reminder.completedAt)}`;
  }

  if (status === "sent" && reminder.sentAt) {
    return `Delivered ${formatReminderDateTime(reminder.sentAt)}`;
  }

  if (status === "overdue") {
    return "The scheduled time has passed without delivery.";
  }

  return "Scheduled for in-app delivery.";
}
