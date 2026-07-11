"use client";

import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReminderDeleteConfirmationProps {
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function ReminderDeleteConfirmation({
  isDeleting,
  onCancel,
  onConfirm
}: ReminderDeleteConfirmationProps) {
  return (
    <div className="grid gap-2 border-t border-red-400/25 bg-red-400/10 px-3 py-3 text-xs text-red-100 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <span>Remove this reminder permanently?</span>
      <span className="grid grid-cols-2 gap-2">
        <Button disabled={isDeleting} onClick={onCancel} size="sm" type="button" variant="ghost">
          <X className="h-4 w-4" aria-hidden="true" />
          Cancel
        </Button>
        <Button
          disabled={isDeleting}
          onClick={() => {
            void onConfirm();
          }}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {isDeleting ? "Removing..." : "Remove"}
        </Button>
      </span>
    </div>
  );
}
