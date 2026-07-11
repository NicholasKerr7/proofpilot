import { ReminderRow } from "@/components/app/reminders/reminder-row";
import type { CaseReminder } from "@/lib/client/types";

interface ReminderListProps {
  caseDeadline: string | null;
  deletingReminderId: string | null;
  expandedReminderId: string | null;
  isLoading: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  onRequestDelete: (reminderId: string) => void;
  onToggleReminder: (reminderId: string) => void;
  reminderToDeleteId: string | null;
  reminders: CaseReminder[];
}

export function ReminderList({
  caseDeadline,
  deletingReminderId,
  expandedReminderId,
  isLoading,
  onCancelDelete,
  onConfirmDelete,
  onRequestDelete,
  onToggleReminder,
  reminderToDeleteId,
  reminders
}: ReminderListProps) {
  if (!isLoading && !reminders.length) {
    return (
      <p className="rounded-md border border-dashed border-border bg-secondary/25 px-3 py-4 text-sm text-muted-foreground">
        No reminders match this filter.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {reminders.map((reminder) => (
        <ReminderRow
          key={reminder.id}
          caseDeadline={caseDeadline}
          isDeleting={Boolean(deletingReminderId)}
          isExpanded={expandedReminderId === reminder.id}
          isPendingDelete={reminderToDeleteId === reminder.id}
          onCancelDelete={onCancelDelete}
          onConfirmDelete={onConfirmDelete}
          onRequestDelete={() => onRequestDelete(reminder.id)}
          onToggle={() => onToggleReminder(reminder.id)}
          reminder={reminder}
        />
      ))}
    </div>
  );
}
