import type { CaseStatus } from "./cases.js";

export const defaultCaseStatusOptions = ["DRAFT", "COLLECTING_EVIDENCE"] as const;
export const itemsPerPageOptions = [10, 25, 50] as const;
export const appThemeOptions = ["DARK", "LIGHT", "SYSTEM"] as const;
export const accentColorOptions = ["COPPER", "CHAMPAGNE", "TEAL"] as const;
export const exportFormatOptions = ["PDF", "CSV"] as const;

export type DefaultCaseStatus = Extract<
  CaseStatus,
  (typeof defaultCaseStatusOptions)[number]
>;
export type ItemsPerPage = (typeof itemsPerPageOptions)[number];
export type AppTheme = (typeof appThemeOptions)[number];
export type AccentColor = (typeof accentColorOptions)[number];
export type ExportFormat = (typeof exportFormatOptions)[number];

export interface UserSettingsValues {
  autoSave: boolean;
  confirmBeforeDelete: boolean;
  defaultCaseStatus: DefaultCaseStatus;
  itemsPerPage: ItemsPerPage;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  notifyCaseUpdates: boolean;
  notifyDeadlineReminders: boolean;
  notifyEvidenceProcessing: boolean;
  notifyPacketReady: boolean;
  theme: AppTheme;
  accentColor: AccentColor;
  reduceMotion: boolean;
  cloudSync: boolean;
  syncOverCellular: boolean;
  exportFormat: ExportFormat;
  analyticsUsageData: boolean;
  marketingCommunications: boolean;
}

export interface UserSettingsStorage {
  documentBytes: number;
  documentCount: number;
  exportBytes: number;
  exportCount: number;
  usedBytes: number;
}

export interface UserSettings extends UserSettingsValues {
  lastSyncedAt: string;
  updatedAt: string;
  storage: UserSettingsStorage;
}

export type UpdateUserSettingsInput = Partial<UserSettingsValues>;

export const defaultUserSettingsValues: UserSettingsValues = {
  autoSave: true,
  confirmBeforeDelete: true,
  defaultCaseStatus: "DRAFT",
  itemsPerPage: 25,
  emailNotifications: true,
  inAppNotifications: true,
  notifyCaseUpdates: true,
  notifyDeadlineReminders: true,
  notifyEvidenceProcessing: true,
  notifyPacketReady: true,
  theme: "DARK",
  accentColor: "COPPER",
  reduceMotion: false,
  cloudSync: true,
  syncOverCellular: false,
  exportFormat: "PDF",
  analyticsUsageData: false,
  marketingCommunications: false
};
