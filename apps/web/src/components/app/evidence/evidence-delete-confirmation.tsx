"use client";

import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EvidenceDeleteConfirmationProps {
  isDeleting: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function EvidenceDeleteConfirmation({
  isDeleting,
  message,
  onCancel,
  onConfirm
}: EvidenceDeleteConfirmationProps) {
  return (
    <div className="grid gap-2 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-100">
      <span>{message}</span>
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
          {isDeleting ? "Deleting..." : "Delete"}
        </Button>
      </span>
    </div>
  );
}
