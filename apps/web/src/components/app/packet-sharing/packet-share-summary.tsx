import {
  CalendarClock,
  FileArchive,
  FileText,
  KeyRound,
  Mail,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import type {
  PacketShareEmailDeliveryMode,
  PacketSharePacketSummary
} from "@proofpilot/types";
import {
  formatPacketShareBytes,
  formatPacketShareDate
} from "@/components/app/packet-sharing/packet-sharing-utils";
import {
  getPacketSharePermissionSummary,
  resolvePacketShareExpiration,
  type PacketShareExpiryMode,
  type PacketShareRecipientDraft
} from "@/components/app/packet-sharing/packet-sharing-ui";
import { Badge } from "@/components/ui/badge";

interface PacketShareSummaryProps {
  deliveryMode: PacketShareEmailDeliveryMode;
  expiryMode: PacketShareExpiryMode;
  ownerName: string;
  packet: PacketSharePacketSummary;
  recipients: PacketShareRecipientDraft[];
  specificDate: string;
}

export function PacketShareSummary({
  deliveryMode,
  expiryMode,
  ownerName,
  packet,
  recipients,
  specificDate
}: PacketShareSummaryProps) {
  const populatedRecipients = recipients.filter((recipient) => recipient.email.trim());
  const expiration = getSummaryExpiration(expiryMode, specificDate);
  const sendsRecipientEmail = deliveryMode === "RESEND";

  return (
    <aside className="grid content-start gap-4 rounded-md border border-border bg-card p-4 md:sticky md:top-24 md:p-5">
      <section aria-labelledby="packet-share-summary-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="packet-share-summary-heading" className="text-sm font-semibold uppercase text-primary">
            Share summary
          </h2>
          <Badge variant="secondary">
            {sendsRecipientEmail ? "Email delivery" : "Simulation"}
          </Badge>
        </div>
        <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
          <SummaryRow icon={FileArchive} label="Packet" value={packet.title} />
          <SummaryRow
            icon={FileText}
            label="PDF"
            value={formatPacketShareBytes(packet.byteSize)}
          />
          <SummaryRow
            icon={UsersRound}
            label="Recipients"
            value={String(populatedRecipients.length)}
          />
          <SummaryRow
            icon={KeyRound}
            label="Permissions"
            value={getPacketSharePermissionSummary(populatedRecipients)}
          />
          <SummaryRow
            icon={CalendarClock}
            label="Expires"
            value={formatPacketShareDate(expiration)}
          />
          <SummaryRow
            icon={Mail}
            label="Delivery"
            value={
              sendsRecipientEmail
                ? "Email recipients automatically"
                : "Simulated; send manually"
            }
          />
        </dl>
      </section>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-primary/25 bg-primary/5 p-3 text-sm leading-6 text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
        <p>Only listed recipient emails can exchange the share link for packet access.</p>
      </div>

      <section aria-labelledby="packet-email-preview-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="packet-email-preview-heading" className="text-sm font-semibold uppercase text-primary">
            Email preview
          </h2>
          <span className="text-xs text-muted-foreground">
            {sendsRecipientEmail ? "Automatic delivery" : "Manual delivery"}
          </span>
        </div>
        <div className="mt-3 rounded-md border border-border bg-background/45 p-4 text-sm leading-6 text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Subject:</span>{" "}
            {sendsRecipientEmail
              ? `${ownerName} shared a ProofPilot packet`
              : `Shared: ${packet.title}`}
          </p>
          <p className="mt-3">Hi,</p>
          <p className="mt-3">{ownerName} shared a ProofPilot case packet with you.</p>
          <p className="mt-3">
            {sendsRecipientEmail
              ? "Use the secure link in this email to open the packet with your invited address."
              : "The private link will be included when the owner opens their email app after creating the share."}
          </p>
          <p className="mt-3">
            Expires: {formatPacketShareDate(expiration)}
          </p>
        </div>
      </section>
    </aside>
  );
}

interface SummaryRowProps {
  icon: typeof FileArchive;
  label: string;
  value: string;
}

function SummaryRow({ icon: Icon, label, value }: SummaryRowProps) {
  return (
    <div className="grid min-h-12 grid-cols-[1.25rem_6rem_minmax(0,1fr)] items-center gap-2 py-2.5">
      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function getSummaryExpiration(mode: PacketShareExpiryMode, specificDate: string) {
  try {
    return resolvePacketShareExpiration(mode, specificDate);
  } catch {
    return null;
  }
}
