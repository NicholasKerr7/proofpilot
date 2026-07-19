"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Copy,
  Download,
  Eye,
  Link2,
  MailCheck,
  MessageSquareText,
  Send,
  ShieldCheck,
  Trash2
} from "lucide-react";
import type {
  CreatePacketShareInput,
  PacketShareCreatedResponse,
  PacketSharePermission,
  PacketSharePreparationResponse
} from "@proofpilot/types";
import { PacketShareHero } from "@/components/app/packet-sharing/packet-share-hero";
import { PacketShareRecipients } from "@/components/app/packet-sharing/packet-share-recipients";
import { PacketShareSummary } from "@/components/app/packet-sharing/packet-share-summary";
import {
  addSuggestedPacketRecipients,
  createPacketShareRecipient,
  getDefaultPacketShareDate,
  isValidPacketRecipientEmail,
  packetSharePermissionOptions,
  resolvePacketShareExpiration,
  type PacketShareExpiryMode,
  type PacketShareRecipientDraft
} from "@/components/app/packet-sharing/packet-sharing-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CaseRecord } from "@/lib/client/types";

interface PacketShareComposeProps {
  caseRecord: CaseRecord;
  onBack: () => void;
  onCreate: (input: CreatePacketShareInput) => Promise<PacketShareCreatedResponse>;
  onCreated: (share: PacketShareCreatedResponse) => void;
  onRevoke: (shareId: string) => Promise<void>;
  ownerName: string;
  preparation: PacketSharePreparationResponse & {
    packet: NonNullable<PacketSharePreparationResponse["packet"]>;
  };
}

const permissionIcons = {
  COMMENT: MessageSquareText,
  DOWNLOAD: Download,
  VIEW: Eye
} satisfies Record<PacketSharePermission, typeof Eye>;

export function PacketShareCompose({
  caseRecord,
  onBack,
  onCreate,
  onCreated,
  onRevoke,
  ownerName,
  preparation
}: PacketShareComposeProps) {
  const [recipients, setRecipients] = useState<PacketShareRecipientDraft[]>(() => [
    createPacketShareRecipient()
  ]);
  const [defaultPermission, setDefaultPermission] = useState<PacketSharePermission>("VIEW");
  const [expiryMode, setExpiryMode] = useState<PacketShareExpiryMode>("seven-days");
  const [specificDate, setSpecificDate] = useState(getDefaultPacketShareDate);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revokingShareId, setRevokingShareId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setPermission(permission: PacketSharePermission) {
    setDefaultPermission(permission);
    setRecipients((current) =>
      current.map((recipient) => ({ ...recipient, permission }))
    );
  }

  function updateRecipient(id: string, patch: Partial<PacketShareRecipientDraft>) {
    setRecipients((current) =>
      current.map((recipient) =>
        recipient.id === id ? { ...recipient, ...patch } : recipient
      )
    );
  }

  function removeRecipient(id: string) {
    setRecipients((current) => current.filter((recipient) => recipient.id !== id));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedRecipients = recipients.map((recipient) => ({
      email: recipient.email.trim().toLowerCase(),
      permission: recipient.permission
    }));

    if (normalizedRecipients.some((recipient) => !isValidPacketRecipientEmail(recipient.email))) {
      setError("Enter a valid email address for every recipient.");
      return;
    }

    if (new Set(normalizedRecipients.map((recipient) => recipient.email)).size !== normalizedRecipients.length) {
      setError("Each recipient email can appear only once.");
      return;
    }

    setIsSubmitting(true);

    try {
      const createdShare = await onCreate({
        expiresAt: resolvePacketShareExpiration(expiryMode, specificDate),
        packetExportId: preparation.packet.exportId,
        recipients: normalizedRecipients,
        requireEmailVerification: false,
        watermarkDocuments: false
      });
      onCreated(createdShare);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Packet share could not be created."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevoke(shareId: string) {
    if (!window.confirm("Revoke this packet link? Recipients will lose access immediately.")) {
      return;
    }

    setError(null);
    setRevokingShareId(shareId);

    try {
      await onRevoke(shareId);
    } catch (revokeError) {
      setError(
        revokeError instanceof Error ? revokeError.message : "Packet share could not be revoked."
      );
    } finally {
      setRevokingShareId(null);
    }
  }

  return (
    <form className="grid gap-5" id="packet-share-form" onSubmit={handleSubmit}>
      <header className="flex items-start gap-3">
        <Button
          aria-label="Back to packet export"
          className="mt-0.5 shrink-0"
          onClick={onBack}
          size="icon"
          title="Back to packet export"
          type="button"
          variant="ghost"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold leading-8 md:text-3xl">Share packet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a recipient-limited link to the latest PDF export.
          </p>
        </div>
      </header>

      <PacketShareHero caseRecord={caseRecord} />

      <div className="grid gap-5 md:grid-cols-[minmax(0,1.12fr)_minmax(19rem,0.88fr)] md:items-start">
        <div className="grid gap-4">
          <PacketShareRecipients
            onAdd={() =>
              setRecipients((current) =>
                current.length < 10
                  ? [...current, createPacketShareRecipient("", defaultPermission)]
                  : current
              )
            }
            onAddSuggested={() =>
              setRecipients((current) =>
                addSuggestedPacketRecipients(
                  current,
                  preparation.suggestedRecipients,
                  defaultPermission
                ).slice(0, 10)
              )
            }
            onChange={updateRecipient}
            onRemove={removeRecipient}
            recipients={recipients}
            suggestions={preparation.suggestedRecipients}
          />

          <section aria-labelledby="packet-permissions-heading" className="grid gap-4 rounded-md border border-border bg-card p-4 md:p-5">
            <div>
              <h2 id="packet-permissions-heading" className="text-sm font-semibold uppercase text-primary">
                Default permission
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This choice updates every current recipient. Individual rows can be changed after.
              </p>
            </div>
            <div className="grid gap-2">
              {packetSharePermissionOptions.map((option) => {
                const Icon = permissionIcons[option.value];

                return (
                  <label className="grid cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)] gap-3 rounded-md border border-border bg-secondary/25 p-3" key={option.value}>
                    <input
                      checked={defaultPermission === option.value}
                      className="mt-1 h-4 w-4 accent-primary"
                      name="packet-permission"
                      onChange={() => setPermission(option.value)}
                      type="radio"
                      value={option.value}
                    />
                    <Icon className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-medium text-foreground">{option.label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <ExpirySettings
            expiryMode={expiryMode}
            onExpiryModeChange={setExpiryMode}
            onSpecificDateChange={setSpecificDate}
            specificDate={specificDate}
          />

          <section aria-labelledby="packet-security-heading" className="grid gap-4 rounded-md border border-border bg-card p-4 md:p-5">
            <div>
              <h2 id="packet-security-heading" className="text-sm font-semibold uppercase text-primary">
                Security options
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Additional processing stays off until the required providers are configured.
              </p>
            </div>
            <UnavailableSecurityOption
              description="Require a one-time email challenge before access."
              icon={MailCheck}
              label="Email verification"
            />
            <UnavailableSecurityOption
              description="Add recipient identity to every PDF page."
              icon={ShieldCheck}
              label="Document watermark"
            />
          </section>

          {preparation.activeShares.length ? (
            <section aria-labelledby="active-packet-shares-heading" className="rounded-md border border-border bg-card p-4 md:p-5">
              <div>
                <h2 id="active-packet-shares-heading" className="text-sm font-semibold uppercase text-primary">
                  Active links
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Revoke links that should no longer open this packet.
                </p>
              </div>
              <div className="mt-3 divide-y divide-border border-y border-border">
                {preparation.activeShares.map((share) => (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3" key={share.id}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {share.recipientCount} {share.recipientCount === 1 ? "recipient" : "recipients"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Created {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(share.createdAt))} / {share.expiresAt ? `expires ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(share.expiresAt))}` : "no expiration"}
                      </p>
                    </div>
                    <Button
                      disabled={revokingShareId === share.id}
                      onClick={() => {
                        void handleRevoke(share.id);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      {revokingShareId === share.id ? "Revoking..." : "Revoke"}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <PacketShareSummary
          expiryMode={expiryMode}
          ownerName={ownerName}
          packet={preparation.packet}
          recipients={recipients}
          specificDate={specificDate}
        />
      </div>

      {error ? (
        <p className="rounded-md border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
        <Button disabled type="button" variant="outline">
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copy secure link
        </Button>
        <Button disabled={isSubmitting} type="submit">
          <Send className="h-4 w-4" aria-hidden="true" />
          {isSubmitting ? "Creating link..." : "Create share link"}
        </Button>
      </div>
      <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <Link2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        Email delivery is not configured. You can copy or email the link after creation.
      </p>
    </form>
  );
}

interface ExpirySettingsProps {
  expiryMode: PacketShareExpiryMode;
  onExpiryModeChange: (mode: PacketShareExpiryMode) => void;
  onSpecificDateChange: (date: string) => void;
  specificDate: string;
}

function ExpirySettings({
  expiryMode,
  onExpiryModeChange,
  onSpecificDateChange,
  specificDate
}: ExpirySettingsProps) {
  return (
    <section aria-labelledby="packet-expiry-heading" className="grid gap-4 rounded-md border border-border bg-card p-4 md:p-5">
      <div>
        <h2 id="packet-expiry-heading" className="text-sm font-semibold uppercase text-primary">
          Expiry settings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Set when recipient access ends.</p>
      </div>
      <div className="grid gap-2">
        <ExpiryOption
          checked={expiryMode === "seven-days"}
          description="Access ends seven days after this link is created."
          icon={Clock3}
          label="Expires in 7 days"
          onChange={() => onExpiryModeChange("seven-days")}
          value="seven-days"
        />
        <ExpiryOption
          checked={expiryMode === "specific-date"}
          description="Choose a calendar date for access to end."
          icon={CalendarDays}
          label="Expires on a specific date"
          onChange={() => onExpiryModeChange("specific-date")}
          value="specific-date"
        />
        {expiryMode === "specific-date" ? (
          <div className="grid gap-1.5 pl-8">
            <Label htmlFor="packet-expiration-date">Expiration date</Label>
            <Input
              id="packet-expiration-date"
              onChange={(event) => onSpecificDateChange(event.target.value)}
              required
              type="date"
              value={specificDate}
            />
          </div>
        ) : null}
        <ExpiryOption
          checked={expiryMode === "no-expiration"}
          description="Access remains active until the share is revoked."
          icon={Link2}
          label="No expiration"
          onChange={() => onExpiryModeChange("no-expiration")}
          value="no-expiration"
        />
      </div>
    </section>
  );
}

interface ExpiryOptionProps {
  checked: boolean;
  description: string;
  icon: typeof Clock3;
  label: string;
  onChange: () => void;
  value: PacketShareExpiryMode;
}

function ExpiryOption({
  checked,
  description,
  icon: Icon,
  label,
  onChange,
  value
}: ExpiryOptionProps) {
  return (
    <label className="grid cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)] gap-3 rounded-md px-2 py-2">
      <input
        checked={checked}
        className="mt-1 h-4 w-4 accent-primary"
        name="packet-expiration"
        onChange={onChange}
        type="radio"
        value={value}
      />
      <Icon className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
      <span>
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

interface UnavailableSecurityOptionProps {
  description: string;
  icon: typeof ShieldCheck;
  label: string;
}

function UnavailableSecurityOption({
  description,
  icon: Icon,
  label
}: UnavailableSecurityOptionProps) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-t border-border pt-3">
      <Icon className="mt-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{label}</p>
          <Badge variant="secondary">Unavailable</Badge>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Switch
        aria-label={`${label} unavailable`}
        checked={false}
        disabled
        onCheckedChange={() => undefined}
      />
    </div>
  );
}
