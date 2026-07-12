export const connectionProviderOptions = [
  "GMAIL",
  "GOOGLE_DRIVE",
  "DROPBOX",
  "PAYPAL",
  "ONEDRIVE",
  "BOX"
] as const;

export const connectionModeOptions = ["DEMO", "OAUTH"] as const;

export type ConnectionProvider = (typeof connectionProviderOptions)[number];
export type ConnectionMode = (typeof connectionModeOptions)[number];
export type ConnectionStatus = "CONNECTED" | "NOT_CONNECTED";

export interface AccountConnection {
  accountLabel: string | null;
  authorizationConfigured: boolean;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  mode: ConnectionMode | null;
  provider: ConnectionProvider;
  status: ConnectionStatus;
}
