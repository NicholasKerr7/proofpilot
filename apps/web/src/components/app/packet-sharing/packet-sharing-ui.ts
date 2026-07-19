import type {
  PacketSharePermission,
  PacketShareSuggestedRecipient
} from "@proofpilot/types";

export type PacketShareExpiryMode = "seven-days" | "specific-date" | "no-expiration";

export interface PacketShareRecipientDraft {
  email: string;
  id: string;
  permission: PacketSharePermission;
}

export const packetSharePermissionOptions: Array<{
  description: string;
  label: string;
  value: PacketSharePermission;
}> = [
  {
    description: "Open the packet in the recipient viewer.",
    label: "Can view",
    value: "VIEW"
  },
  {
    description: "Open the packet and add recipient comments.",
    label: "Can comment",
    value: "COMMENT"
  },
  {
    description: "Open, comment on, and download the PDF.",
    label: "Can download",
    value: "DOWNLOAD"
  }
];

export function createPacketShareRecipient(
  email = "",
  permission: PacketSharePermission = "VIEW"
): PacketShareRecipientDraft {
  return {
    email,
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    permission
  };
}

export function addSuggestedPacketRecipients(
  current: PacketShareRecipientDraft[],
  suggestions: PacketShareSuggestedRecipient[],
  permission: PacketSharePermission
) {
  const populated = current.filter((recipient) => recipient.email.trim());
  const existingEmails = new Set(
    populated.map((recipient) => recipient.email.trim().toLowerCase())
  );
  const added = suggestions
    .filter((suggestion) => !existingEmails.has(suggestion.email.toLowerCase()))
    .map((suggestion) => createPacketShareRecipient(suggestion.email, permission));

  return added.length ? [...populated, ...added] : current;
}

export function resolvePacketShareExpiration(
  mode: PacketShareExpiryMode,
  specificDate: string
) {
  if (mode === "no-expiration") {
    return null;
  }

  if (mode === "specific-date") {
    if (!specificDate) {
      throw new Error("Choose an expiration date.");
    }

    const expiration = new Date(`${specificDate}T23:59:59`);

    if (!Number.isFinite(expiration.getTime())) {
      throw new Error("Choose a valid expiration date.");
    }

    return expiration.toISOString();
  }

  const expiration = new Date();
  expiration.setDate(expiration.getDate() + 7);
  return expiration.toISOString();
}

export function getDefaultPacketShareDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPacketSharePermissionSummary(
  recipients: PacketShareRecipientDraft[]
) {
  const permissions = new Set(recipients.map((recipient) => recipient.permission));

  if (permissions.size !== 1) {
    return "Mixed";
  }

  const permission = recipients[0]?.permission;
  return packetSharePermissionOptions.find((option) => option.value === permission)?.label ?? "View";
}

export function getRecipientInitials(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const parts = localPart.split(/[._-]/).filter(Boolean);

  if (!parts.length) {
    return "PP";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function isValidPacketRecipientEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
