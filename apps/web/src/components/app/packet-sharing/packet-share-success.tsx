"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  FileText,
  LifeBuoy,
  Mail,
  ShieldX,
  Trash2,
  UsersRound
} from "lucide-react";
import type {
  PacketShareCreatedResponse,
  PacketShareSuggestedRecipient
} from "@proofpilot/types";
import { PacketShareHero } from "@/components/app/packet-sharing/packet-share-hero";
import {
  formatPacketShareBytes,
  formatPacketShareDate,
  getPacketSharePermissionLabel
} from "@/components/app/packet-sharing/packet-sharing-utils";
import { getRecipientInitials } from "@/components/app/packet-sharing/packet-sharing-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CaseRecord } from "@/lib/client/types";

interface PacketShareSuccessProps {
  caseRecord: CaseRecord;
  onBack: () => void;
  onDone: () => void;
  onOpenSupport: () => void;
  onRevoke: (shareId: string) => Promise<void>;
  ownerName: string;
  share: PacketShareCreatedResponse;
  suggestedRecipients: PacketShareSuggestedRecipient[];
}

export function PacketShareSuccess({
  caseRecord,
  onBack,
  onDone,
  onOpenSupport,
  onRevoke,
  ownerName,
  share,
  suggestedRecipients
}: PacketShareSuccessProps) {
  const [didCopy, setDidCopy] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isRevoked, setIsRevoked] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const emailHref = createShareEmailHref(share, ownerName);

  async function handleCopy() {
    setActionError(null);

    try {
      await copyText(share.shareUrl);
      setDidCopy(true);
    } catch {
      setActionError("The link could not be copied. Open your email app to share it instead.");
    }
  }

  async function handleRevoke() {
    if (!window.confirm("Revoke this packet link? Recipients will lose access immediately.")) {
      return;
    }

    setActionError(null);
    setIsRevoking(true);

    try {
      await onRevoke(share.id);
      setIsRevoked(true);
    } catch (revokeError) {
      setActionError(
        revokeError instanceof Error ? revokeError.message : "Packet share could not be revoked."
      );
    } finally {
      setIsRevoking(false);
    }
  }

  return (
    <div className="grid gap-5">
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
            Manage the new recipient link and delivery actions.
          </p>
        </div>
      </header>

      <PacketShareHero caseRecord={caseRecord} showReadiness={false} />

      <section className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-md border border-teal-400/35 bg-teal-400/10 p-4 md:p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-teal-300/60 text-teal-200">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold text-teal-50">Share link created successfully</h2>
          <p className="mt-1 text-sm leading-6 text-teal-100/75">
            The link is ready to copy or open in your email app. No email was sent automatically.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <section aria-labelledby="shared-packet-details-heading" className="grid gap-4 rounded-md border border-border bg-card p-4 md:p-5">
          <h2 id="shared-packet-details-heading" className="text-sm font-semibold uppercase text-primary">
            Packet details
          </h2>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary">
              <FileText className="h-7 w-7" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="break-words font-semibold">{share.packet.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Generated {formatPacketShareDate(share.packet.createdAt, "Recently")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {formatPacketShareBytes(share.packet.byteSize)}
                </Badge>
                <Badge variant={share.expiresAt ? "warning" : "secondary"}>
                  {share.expiresAt
                    ? `Expires ${formatPacketShareDate(share.expiresAt)}`
                    : "No expiration"}
                </Badge>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="shared-packet-recipients-heading" className="rounded-md border border-border bg-card p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="shared-packet-recipients-heading" className="text-sm font-semibold uppercase text-primary">
              Recipients ({share.recipients.length})
            </h2>
            <UsersRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="mt-3 divide-y divide-border border-y border-border">
            {share.recipients.map((recipient) => {
              const suggestion = suggestedRecipients.find(
                (item) => item.email.toLowerCase() === recipient.email.toLowerCase()
              );

              return (
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]" key={recipient.id}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/45 bg-primary/5 text-xs font-semibold text-primary">
                    {getRecipientInitials(recipient.email)}
                  </span>
                  <div className="min-w-0">
                    {suggestion?.name ? (
                      <p className="truncate text-sm font-medium">{suggestion.name}</p>
                    ) : null}
                    <p className="truncate text-xs text-muted-foreground">{recipient.email}</p>
                  </div>
                  <Badge className="col-span-2 justify-self-start sm:col-span-1" variant="secondary">
                    {getPacketSharePermissionLabel(recipient.permission)}
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {actionError ? (
        <p className="rounded-md border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100" role="alert">
          {actionError}
        </p>
      ) : null}

      {isRevoked ? (
        <section className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-amber-300/30 bg-amber-300/10 p-4">
          <ShieldX className="h-5 w-5 text-amber-200" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-amber-50">Share link revoked</h2>
            <p className="mt-1 text-sm text-amber-100/75">
              Recipients can no longer exchange this link for packet access.
            </p>
          </div>
        </section>
      ) : (
        <section aria-labelledby="packet-share-actions-heading" className="rounded-md border border-border bg-card p-4 md:p-5">
        <h2 id="packet-share-actions-heading" className="text-sm font-semibold uppercase text-primary">
          Share actions
        </h2>
        <div className="mt-3 divide-y divide-border border-y border-border">
          <ShareActionButton
            description="Copy the recipient link to your clipboard"
            icon={didCopy ? Check : Copy}
            label={didCopy ? "Link copied" : "Copy link"}
            onClick={() => {
              void handleCopy();
            }}
          />
          <ShareActionLink
            description="Open a prefilled message in your email app"
            href={emailHref}
            icon={Mail}
            label="Email recipients"
          />
          <ShareActionLink
            description="Download the owner copy of this PDF"
            href={share.ownerDownloadUrl}
            icon={Download}
            label="Export PDF"
            newTab
          />
          <ShareActionButton
            description="Open support with this case selected"
            icon={LifeBuoy}
            label="Contact support"
            onClick={onOpenSupport}
          />
          <ShareActionButton
            description="End recipient access to this share immediately"
            disabled={isRevoking}
            icon={Trash2}
            label={isRevoking ? "Revoking link..." : "Revoke link"}
            onClick={() => {
              void handleRevoke();
            }}
          />
        </div>
      </section>
      )}

      <Button className="min-h-12" onClick={onDone} type="button">
        Done
      </Button>
    </div>
  );
}

interface ShareActionProps {
  description: string;
  disabled?: boolean;
  icon: typeof Copy;
  label: string;
}

function ShareActionButton({
  description,
  disabled = false,
  icon: Icon,
  label,
  onClick
}: ShareActionProps & { onClick: () => void }) {
  return (
    <button
      className="grid min-h-16 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/35 bg-primary/5 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function ShareActionLink({
  description,
  href,
  icon: Icon,
  label,
  newTab = false
}: ShareActionProps & { href: string; newTab?: boolean }) {
  return (
    <a
      className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      href={href}
      rel={newTab ? "noreferrer" : undefined}
      target={newTab ? "_blank" : undefined}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/35 bg-primary/5 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </a>
  );
}

function createShareEmailHref(share: PacketShareCreatedResponse, ownerName: string) {
  const bcc = share.recipients.map((recipient) => recipient.email).join(",");
  const expiration = share.expiresAt
    ? `This link expires ${formatPacketShareDate(share.expiresAt)}.`
    : "This link does not have an automatic expiration.";
  const subject = `Shared: ${share.packet.title}`;
  const body = [
    "Hi,",
    "",
    `${ownerName} shared a ProofPilot case packet with you.`,
    "",
    share.shareUrl,
    "",
    expiration,
    "",
    "The invited email address is required to open the packet."
  ].join("\n");

  return `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.className = "fixed left-[-9999px] top-0";
  document.body.append(textArea);
  textArea.select();
  const didCopy = document.execCommand("copy");
  textArea.remove();

  if (!didCopy) {
    throw new Error("Clipboard copy failed.");
  }
}
