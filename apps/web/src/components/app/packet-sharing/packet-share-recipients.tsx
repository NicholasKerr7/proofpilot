import { Plus, UserRoundPlus, X } from "lucide-react";
import type {
  PacketSharePermission,
  PacketShareSuggestedRecipient
} from "@proofpilot/types";
import {
  packetSharePermissionOptions,
  type PacketShareRecipientDraft
} from "@/components/app/packet-sharing/packet-sharing-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface PacketShareRecipientsProps {
  onAdd: () => void;
  onAddSuggested: () => void;
  onChange: (id: string, patch: Partial<PacketShareRecipientDraft>) => void;
  onRemove: (id: string) => void;
  recipients: PacketShareRecipientDraft[];
  suggestions: PacketShareSuggestedRecipient[];
}

export function PacketShareRecipients({
  onAdd,
  onAddSuggested,
  onChange,
  onRemove,
  recipients,
  suggestions
}: PacketShareRecipientsProps) {
  return (
    <section aria-labelledby="packet-share-recipients-heading" className="grid gap-4 rounded-md border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="packet-share-recipients-heading" className="text-sm font-semibold uppercase text-primary">
            Recipients
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Add up to 10 email addresses and set access for each recipient.
          </p>
        </div>
        <Button
          disabled={!suggestions.length}
          onClick={onAddSuggested}
          size="sm"
          type="button"
          variant="ghost"
        >
          <UserRoundPlus className="h-4 w-4" aria-hidden="true" />
          Add collaborators
        </Button>
      </div>

      <div className="grid gap-3">
        {recipients.map((recipient, index) => (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]" key={recipient.id}>
            <div className="grid gap-1.5">
              <Label className={index ? "sr-only" : undefined} htmlFor={`packet-recipient-${recipient.id}`}>
                Recipient email
              </Label>
              <Input
                autoComplete="off"
                id={`packet-recipient-${recipient.id}`}
                onChange={(event) => onChange(recipient.id, { email: event.target.value })}
                placeholder="recipient@example.com"
                required
                type="email"
                value={recipient.email}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className={index ? "sr-only" : undefined} htmlFor={`packet-permission-${recipient.id}`}>
                Permission
              </Label>
              <Select
                id={`packet-permission-${recipient.id}`}
                onChange={(event) =>
                  onChange(recipient.id, {
                    permission: event.target.value as PacketSharePermission
                  })
                }
                value={recipient.permission}
              >
                {packetSharePermissionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              aria-label={`Remove recipient ${index + 1}`}
              className="self-end"
              disabled={recipients.length === 1}
              onClick={() => onRemove(recipient.id)}
              size="icon"
              title="Remove recipient"
              type="button"
              variant="ghost"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        className="justify-start"
        disabled={recipients.length >= 10}
        onClick={onAdd}
        type="button"
        variant="outline"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add another recipient
      </Button>
    </section>
  );
}
