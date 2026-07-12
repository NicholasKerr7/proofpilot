import {
  connectionProviderOptions,
  type AccountConnection,
  type ConnectionProvider
} from "@proofpilot/types";

interface ConnectionProviderPresentation {
  capability: string;
  description: string;
  label: string;
  logoSrc: string;
  permission: string;
}

export const connectionProviderPresentation: Record<
  ConnectionProvider,
  ConnectionProviderPresentation
> = {
  GMAIL: {
    capability: "Email import",
    description: "Securely import emails and attachments into your cases.",
    label: "Gmail",
    logoSrc: "/integrations/gmail.svg",
    permission: "Import only the emails and attachments you select."
  },
  GOOGLE_DRIVE: {
    capability: "Document storage",
    description: "Access and import documents from your Google Drive.",
    label: "Google Drive",
    logoSrc: "/integrations/google-drive.svg",
    permission: "Import only the Drive files you select."
  },
  DROPBOX: {
    capability: "File import",
    description: "Import files and folders from your Dropbox account.",
    label: "Dropbox",
    logoSrc: "/integrations/dropbox.svg",
    permission: "Import only the Dropbox files and folders you select."
  },
  PAYPAL: {
    capability: "Financial verification",
    description: "Verify account activity and transaction history for a case.",
    label: "PayPal",
    logoSrc: "/integrations/paypal.svg",
    permission: "Read only the account activity you choose to import."
  },
  ONEDRIVE: {
    capability: "Document storage",
    description: "Store and access documents from Microsoft OneDrive.",
    label: "Microsoft OneDrive",
    logoSrc: "/integrations/onedrive.svg",
    permission: "Import only the OneDrive files you select."
  },
  BOX: {
    capability: "File import",
    description: "Import and manage files from your Box account.",
    label: "Box",
    logoSrc: "/integrations/box.svg",
    permission: "Import only the Box files you select."
  }
};

export function createEmptyConnectionCatalog(): AccountConnection[] {
  return connectionProviderOptions.map((provider) => ({
    accountLabel: null,
    authorizationConfigured: false,
    connectedAt: null,
    lastSyncedAt: null,
    mode: null,
    provider,
    status: "NOT_CONNECTED"
  }));
}

export function formatLastSync(value: string | null, now: number | null) {
  if (!value || now === null) {
    return "Not synced yet";
  }

  const elapsedMinutes = Math.max(0, Math.floor((now - new Date(value).getTime()) / 60_000));

  if (elapsedMinutes < 1) {
    return "Last sync: just now";
  }

  if (elapsedMinutes < 60) {
    return `Last sync: ${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `Last sync: ${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `Last sync: ${elapsedDays}d ago`;
}
