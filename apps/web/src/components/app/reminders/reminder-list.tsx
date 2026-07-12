import { ReminderRow } from "@/components/app/reminders/reminder-row";
import type { UpdateReminderInput } from "@/components/app/reminders/reminder-detail";
import type { CaseRecord, CaseReminder } from "@/lib/client/types";

interface ReminderListProps {
  deletingReminderId: string | null;
  expandedReminderId: string | null;
  isLoading: boolean;
  isUpdatingReminderId: string | null;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
  onRequestDelete: (reminderId: string) => void;
  onToggleReminder: (reminderId: string) => void;
  onUpdateReminder: (
    reminderId: string,
    input: UpdateReminderInput
  ) => Promise<boolean>;
  reminderToDeleteId: string | null;
  reminders: CaseReminder[];
  selectedCase: CaseRecord;
}

export function ReminderList({
  deletingReminderId,
  expandedReminderId,
  isLoading,
  isUpdatingReminderId,
  onCancelDelete,
  onConfirmDelete,
  onRequestDelete,
  onToggleReminder,
  onUpdateReminder,
  reminderToDeleteId,
  reminders,
  selectedCase
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
          isDeleting={Boolean(deletingReminderId)}
          isExpanded={expandedReminderId === reminder.id}
          isPendingDelete={reminderToDeleteId === reminder.id}
          isUpdating={isUpdatingReminderId === reminder.id}
          onCancelDelete={onCancelDelete}
          onConfirmDelete={onConfirmDelete}
          onRequestDelete={() => onRequestDelete(reminder.id)}
          onToggle={() => onToggleReminder(reminder.id)}
          onUpdate={(input) => onUpdateReminder(reminder.id, input)}
          reminder={reminder}
          selectedCase={selectedCase}
        />
      ))}
    </div>
  );
}
