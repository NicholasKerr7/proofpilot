import type { ConnectionMode } from "./connections.js";

export const providerImportProviderOptions = ["GMAIL", "GOOGLE_DRIVE"] as const;

export type ProviderImportProvider = (typeof providerImportProviderOptions)[number];

export interface ProviderImportConnection {
  accountLabel: string;
  lastSyncedAt: string | null;
  mode: ConnectionMode;
  provider: ProviderImportProvider;
}

export interface GmailImportItem {
  id: string;
  kind: "EMAIL";
  mailbox: string;
  preview: string;
  receivedAt: string;
  senderAddress: string;
  senderName: string;
  sizeBytes: number;
  subject: string;
  unread: boolean;
}

export interface GoogleDriveImportItem {
  id: string;
  kind: "FILE" | "FOLDER";
  mimeType: string | null;
  modifiedAt: string;
  name: string;
  ownerLabel: string;
  sizeBytes: number | null;
  source: "MY_DRIVE";
}

export type ProviderImportItem = GmailImportItem | GoogleDriveImportItem;

export interface ProviderImportCatalog {
  connection: ProviderImportConnection;
  items: ProviderImportItem[];
  provider: ProviderImportProvider;
}

export interface ProviderImportedDocument {
  byteSize: number;
  createdAt: string;
  id: string;
  mimeType: string;
  originalName: string;
  status: string;
  updatedAt: string;
}

export interface ProviderImportResponse {
  documents: ProviderImportedDocument[];
  importedCount: number;
  provider: ProviderImportProvider;
}
