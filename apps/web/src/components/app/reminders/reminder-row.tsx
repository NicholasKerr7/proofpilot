import {
  BellRing,
  ChevronDown,
  Clock3,
  Trash2,
  TriangleAlert
} from "lucide-react";
import { ReminderDeleteConfirmation } from "@/components/app/reminders/reminder-delete-confirmation";
import {
  formatReminderDate,
  formatReminderDateTime,
  formatReminderRelativeTime,
  formatReminderTime,
  getReminderStatus
} from "@/components/app/reminders/reminder-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CaseReminder } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface ReminderRowProps {
  caseDeadline: string | null;
  isDeleting: boolean;
  isExpanded: boolean;
  isPendingDelete: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  onRequestDelete: () => void;
  onToggle: () => void;
  reminder: CaseReminder;
}

export function ReminderRow({
  caseDeadline,
  isDeleting,
  isExpanded,
  isPendingDelete,
  onCancelDelete,
  onConfirmDelete,
  onRequestDelete,
  onToggle,
  reminder
}: ReminderRowProps) {
  const status = getReminderStatus(reminder);

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-secondary/30",
        isExpanded ? "border-primary/40 bg-primary/5" : null
      )}
    >
      <div className="grid grid-cols-1 items-start gap-1 p-2 md:grid-cols-[minmax(0,1fr)_auto] md:gap-2 md:p-3">
        <button
          aria-expanded={isExpanded}
          className="grid min-h-20 min-w-0 grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-3 rounded-md p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[3.75rem_minmax(0,1fr)_auto] md:items-center"
          onClick={onToggle}
          type="button"
        >
          <span className={getDateTileClassName(status)}>
            <span className="text-[10px] font-semibold uppercase tracking-normal">
              {formatReminderMonth(reminder.remindAt)}
            </span>
            <span className="text-lg font-semibold leading-none">
              {formatReminderDay(reminder.remindAt)}
            </span>
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="break-words text-sm font-semibold leading-5 text-foreground md:text-base">
                {reminder.message}
              </span>
              <ReminderStatusBadge status={status} />
            </span>
            <span className="mt-1 block text-xs text-muted-foreground md:text-sm">
              {formatReminderDate(reminder.remindAt)} · {formatReminderTime(reminder.remindAt)}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {status === "sent" && reminder.sentAt
                ? `Sent ${formatReminderDate(reminder.sentAt)}`
                : formatReminderRelativeTime(reminder.remindAt)}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform md:mt-0",
              isExpanded ? "rotate-180" : null
            )}
            aria-hidden="true"
          />
        </button>
        <Button
          aria-label={`Remove reminder ${reminder.message}`}
          className="hidden md:inline-flex"
          disabled={isDeleting}
          onClick={onRequestDelete}
          size="icon"
          title={`Remove reminder ${reminder.message}`}
          type="button"
          variant="ghost"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {isExpanded ? (
        <div className="grid gap-4 border-t border-border px-3 py-4 md:grid-cols-3 md:px-4">
          <ReminderMetadata
            icon="schedule"
            label="Scheduled for"
            value={formatReminderDateTime(reminder.remindAt)}
          />
          <ReminderMetadata
            icon="created"
            label="Created"
            value={formatReminderDateTime(reminder.createdAt)}
          />
          <ReminderMetadata
            icon="deadline"
            label="Case deadline"
            value={caseDeadline ? formatReminderDateTime(caseDeadline) : "No deadline set"}
          />
          {reminder.sentAt ? (
            <p className="border-t border-border pt-3 text-xs text-muted-foreground md:col-span-3">
              Sent {formatReminderDateTime(reminder.sentAt)}
            </p>
          ) : null}
          <Button
            className="w-full md:hidden"
            disabled={isDeleting}
            onClick={onRequestDelete}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remove reminder
          </Button>
        </div>
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

function ReminderStatusBadge({ status }: { status: "sent" | "overdue" | "upcoming" }) {
  if (status === "sent") {
    return <Badge variant="success">Sent</Badge>;
  }

  if (status === "overdue") {
    return <Badge variant="danger">Overdue</Badge>;
  }

  return <Badge variant="warning">Upcoming</Badge>;
}

function ReminderMetadata({
  icon,
  label,
  value
}: {
  icon: "schedule" | "created" | "deadline";
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 text-xs">
      <span className="pt-0.5 text-primary">
        {icon === "schedule" ? <BellRing className="h-4 w-4" aria-hidden="true" /> : null}
        {icon === "created" ? <Clock3 className="h-4 w-4" aria-hidden="true" /> : null}
        {icon === "deadline" ? <TriangleAlert className="h-4 w-4" aria-hidden="true" /> : null}
      </span>
      <span>
        <span className="block text-muted-foreground">{label}</span>
        <span className="mt-1 block font-medium leading-5 text-foreground">{value}</span>
      </span>
    </div>
  );
}

function getDateTileClassName(status: "sent" | "overdue" | "upcoming") {
  if (status === "sent") {
    return "flex h-14 w-12 flex-col items-center justify-center gap-1 rounded-md border border-teal-400/25 bg-teal-400/10 text-teal-100 md:w-14";
  }

  if (status === "overdue") {
    return "flex h-14 w-12 flex-col items-center justify-center gap-1 rounded-md border border-red-400/25 bg-red-400/10 text-red-100 md:w-14";
  }

  return "flex h-14 w-12 flex-col items-center justify-center gap-1 rounded-md border border-primary/30 bg-primary/10 text-primary md:w-14";
}

function formatReminderMonth(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short" }).format(new Date(value));
}

function formatReminderDay(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(new Date(value));
}
