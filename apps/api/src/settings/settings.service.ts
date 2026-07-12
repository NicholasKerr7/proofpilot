import { BadRequestException, Injectable } from "@nestjs/common";
import {
  accentColorOptions,
  appThemeOptions,
  defaultCaseStatusOptions,
  defaultUserSettingsValues,
  exportFormatOptions,
  itemsPerPageOptions,
  type UserSettings,
  type UserSettingsStorage
} from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";
import type { UpdateSettingsDto } from "./dto/update-settings.dto.js";

const settingsFields = [
  "autoSave",
  "confirmBeforeDelete",
  "defaultCaseStatus",
  "itemsPerPage",
  "emailNotifications",
  "inAppNotifications",
  "notifyCaseUpdates",
  "notifyDeadlineReminders",
  "notifyEvidenceProcessing",
  "notifyPacketReady",
  "theme",
  "accentColor",
  "reduceMotion",
  "cloudSync",
  "syncOverCellular",
  "exportFormat"
] as const;

const booleanSettingsFields = [
  "autoSave",
  "confirmBeforeDelete",
  "emailNotifications",
  "inAppNotifications",
  "notifyCaseUpdates",
  "notifyDeadlineReminders",
  "notifyEvidenceProcessing",
  "notifyPacketReady",
  "reduceMotion",
  "cloudSync",
  "syncOverCellular"
] as const;

const preferenceSelect = {
  autoSave: true,
  confirmBeforeDelete: true,
  defaultCaseStatus: true,
  itemsPerPage: true,
  emailNotifications: true,
  inAppNotifications: true,
  notifyCaseUpdates: true,
  notifyDeadlineReminders: true,
  notifyEvidenceProcessing: true,
  notifyPacketReady: true,
  theme: true,
  accentColor: true,
  reduceMotion: true,
  cloudSync: true,
  syncOverCellular: true,
  exportFormat: true,
  lastSyncedAt: true,
  updatedAt: true
} as const;

type PreferenceRecord = {
  autoSave: boolean;
  confirmBeforeDelete: boolean;
  defaultCaseStatus: string;
  itemsPerPage: number;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  notifyCaseUpdates: boolean;
  notifyDeadlineReminders: boolean;
  notifyEvidenceProcessing: boolean;
  notifyPacketReady: boolean;
  theme: string;
  accentColor: string;
  reduceMotion: boolean;
  cloudSync: boolean;
  syncOverCellular: boolean;
  exportFormat: string;
  lastSyncedAt: Date;
  updatedAt: Date;
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<UserSettings> {
    const [preference, storage] = await Promise.all([
      this.prisma.userPreference.upsert({
        where: { userId },
        update: {},
        create: { userId },
        select: preferenceSelect
      }),
      this.getStorage(userId)
    ]);

    return this.toSettings(preference, storage);
  }

  async update(userId: string, input: UpdateSettingsDto): Promise<UserSettings> {
    const changedFields = this.validateUpdate(input);
    const lastSyncedAt = new Date();
    const preference = await this.prisma.$transaction(async (tx) => {
      const updatedPreference = await tx.userPreference.upsert({
        where: { userId },
        update: {
          ...input,
          lastSyncedAt
        },
        create: {
          userId,
          ...input,
          lastSyncedAt
        },
        select: preferenceSelect
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "settings.updated",
          metadata: { fields: changedFields }
        }
      });

      return updatedPreference;
    });
    const storage = await this.getStorage(userId);

    return this.toSettings(preference, storage);
  }

  private validateUpdate(input: UpdateSettingsDto) {
    const changedFields = settingsFields.filter((field) => input[field] !== undefined);

    if (!changedFields.length) {
      throw new BadRequestException("Provide at least one setting to update.");
    }

    for (const field of booleanSettingsFields) {
      if (input[field] !== undefined && typeof input[field] !== "boolean") {
        throw new BadRequestException(`${field} must be a boolean.`);
      }
    }

    if (
      input.defaultCaseStatus !== undefined &&
      !defaultCaseStatusOptions.includes(input.defaultCaseStatus)
    ) {
      throw new BadRequestException("Default case status is not supported.");
    }

    if (input.itemsPerPage !== undefined && !itemsPerPageOptions.includes(input.itemsPerPage)) {
      throw new BadRequestException("Items per page is not supported.");
    }

    if (input.theme !== undefined && !appThemeOptions.includes(input.theme)) {
      throw new BadRequestException("Theme is not supported.");
    }

    if (input.accentColor !== undefined && !accentColorOptions.includes(input.accentColor)) {
      throw new BadRequestException("Accent color is not supported.");
    }

    if (input.exportFormat !== undefined && !exportFormatOptions.includes(input.exportFormat)) {
      throw new BadRequestException("Export format is not supported.");
    }

    return changedFields;
  }

  private async getStorage(userId: string): Promise<UserSettingsStorage> {
    const [documents, exports] = await Promise.all([
      this.prisma.document.aggregate({
        where: {
          case: { ownerId: userId }
        },
        _count: { _all: true },
        _sum: { byteSize: true }
      }),
      this.prisma.packetExport.aggregate({
        where: {
          packet: {
            case: { ownerId: userId }
          }
        },
        _count: { _all: true },
        _sum: { byteSize: true }
      })
    ]);
    const documentBytes = documents._sum.byteSize ?? 0;
    const exportBytes = exports._sum.byteSize ?? 0;

    return {
      documentBytes,
      documentCount: documents._count._all,
      exportBytes,
      exportCount: exports._count._all,
      usedBytes: documentBytes + exportBytes
    };
  }

  private toSettings(preference: PreferenceRecord, storage: UserSettingsStorage): UserSettings {
    return {
      autoSave: preference.autoSave,
      confirmBeforeDelete: preference.confirmBeforeDelete,
      defaultCaseStatus: getAllowedValue(
        defaultCaseStatusOptions,
        preference.defaultCaseStatus,
        defaultUserSettingsValues.defaultCaseStatus
      ),
      itemsPerPage: getAllowedValue(
        itemsPerPageOptions,
        preference.itemsPerPage,
        defaultUserSettingsValues.itemsPerPage
      ),
      emailNotifications: preference.emailNotifications,
      inAppNotifications: preference.inAppNotifications,
      notifyCaseUpdates: preference.notifyCaseUpdates,
      notifyDeadlineReminders: preference.notifyDeadlineReminders,
      notifyEvidenceProcessing: preference.notifyEvidenceProcessing,
      notifyPacketReady: preference.notifyPacketReady,
      theme: getAllowedValue(
        appThemeOptions,
        preference.theme,
        defaultUserSettingsValues.theme
      ),
      accentColor: getAllowedValue(
        accentColorOptions,
        preference.accentColor,
        defaultUserSettingsValues.accentColor
      ),
      reduceMotion: preference.reduceMotion,
      cloudSync: preference.cloudSync,
      syncOverCellular: preference.syncOverCellular,
      exportFormat: getAllowedValue(
        exportFormatOptions,
        preference.exportFormat,
        defaultUserSettingsValues.exportFormat
      ),
      lastSyncedAt: preference.lastSyncedAt.toISOString(),
      updatedAt: preference.updatedAt.toISOString(),
      storage
    };
  }
}

function getAllowedValue<const Values extends readonly (number | string)[]>(
  values: Values,
  value: number | string,
  fallback: Values[number]
): Values[number] {
  return (values as readonly (number | string)[]).includes(value)
    ? (value as Values[number])
    : fallback;
}
