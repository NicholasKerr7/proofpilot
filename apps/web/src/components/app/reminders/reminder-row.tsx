import { CheckCircle2, ChevronDown } from "lucide-react";
import {
  ReminderDetail,
  type UpdateReminderInput
} from "@/components/app/reminders/reminder-detail";
import {
  formatReminderDate,
  formatReminderDateTime,
  formatReminderRelativeTime,
  formatReminderStatus,
  formatReminderTime,
  getReminderStatus,
  type ReminderStatus
} from "@/components/app/reminders/reminder-utils";
import { Badge } from "@/components/ui/badge";
import type { CaseRecord, CaseReminder } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface ReminderRowProps {
  isDeleting: boolean;
  isExpanded: boolean;
  isPendingDelete: boolean;
  isUpdating: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  onRequestDelete: () => void;
  onToggle: () => void;
  onUpdate: (input: UpdateReminderInput) => Promise<boolean>;
  reminder: CaseReminder;
  selectedCase: CaseRecord;
}

export function ReminderRow({
  isDeleting,
  isExpanded,
  isPendingDelete,
  isUpdating,
  onCancelDelete,
  onConfirmDelete,
  onRequestDelete,
  onToggle,
  onUpdate,
  reminder,
  selectedCase
}: ReminderRowProps) {
  const status = getReminderStatus(reminder);

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-secondary/30",
        isExpanded ? "border-primary/40 bg-primary/5" : null
      )}
    >
      <div className="p-2 md:p-3">
        <button
          aria-expanded={isExpanded}
          className="grid min-h-20 w-full min-w-0 grid-cols-[3rem_minmax(0,1fr)_auto] items-start gap-3 rounded-md p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-20 md:grid-cols-[3.75rem_minmax(0,1fr)_auto_auto] md:items-center"
          onClick={onToggle}
          type="button"
        >
          <span className={getDateTileClassName(status)}>
            {status === "completed" ? (
              <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
            ) : (
              <>
                <span className="text-[10px] font-semibold uppercase tracking-normal">
                  {formatReminderMonth(reminder.remindAt)}
                </span>
                <span className="text-lg font-semibold leading-none">
                  {formatReminderDay(reminder.remindAt)}
                </span>
              </>
            )}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="break-words text-sm font-semibold leading-5 text-foreground md:text-base">
                {reminder.message}
              </span>
              <span className="md:hidden">
                <ReminderStatusBadge status={status} />
              </span>
            </span>
            <span className="mt-1 block text-xs text-muted-foreground md:text-sm">
              {formatReminderDate(reminder.remindAt)} · {formatReminderTime(reminder.remindAt)}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {getReminderStatusLine(reminder, status)}
            </span>
          </span>
          <span className="hidden md:block">
            <ReminderStatusBadge status={status} />
          </span>
          <ChevronDown
            className={cn(
              "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform md:mt-0",
              isExpanded ? "rotate-180" : null
            )}
            aria-hidden="true"
          />
        </button>
      </div>

      {isExpanded ? (
        <ReminderDetail
          isDeleting={isDeleting}
          isPendingDelete={isPendingDelete}
          isUpdating={isUpdating}
          onCancelDelete={onCancelDelete}
          onConfirmDelete={onConfirmDelete}
          onRequestDelete={onRequestDelete}
          onUpdate={onUpdate}
          reminder={reminder}
          selectedCase={selectedCase}
        />
      ) : null}
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

function getReminderStatusLine(reminder: CaseReminder, status: ReminderStatus) {
  if (status === "completed" && reminder.completedAt) {
    return `Completed ${formatReminderDateTime(reminder.completedAt)}`;
  }

  if (status === "sent" && reminder.sentAt) {
    return `Sent ${formatReminderDateTime(reminder.sentAt)}`;
  }

  return formatReminderRelativeTime(reminder.remindAt);
}

function getDateTileClassName(status: ReminderStatus) {
  if (status === "completed") {
    return "flex h-14 w-12 items-center justify-center rounded-md border border-teal-400/25 bg-teal-400/10 text-teal-100 md:w-14";
  }

  if (status === "sent") {
    return "flex h-14 w-12 flex-col items-center justify-center gap-1 rounded-md border border-sky-400/25 bg-sky-400/10 text-sky-100 md:w-14";
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
