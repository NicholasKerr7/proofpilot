"use client";

import { useState } from "react";
import type { UserSettings } from "@proofpilot/types";
import {
  ChevronDown,
  Cloud,
  Database,
  RefreshCcw,
  Signal
} from "lucide-react";
import {
  SettingsRow,
  SettingsSection,
  StorageMetric
} from "@/components/app/settings/settings-controls";
import type { UpdateSetting } from "@/components/app/settings/settings-types";
import {
  formatSettingsBytes,
  formatSettingsDateTime
} from "@/components/app/settings/settings-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface DataSettingsSectionProps {
  isSaving: boolean;
  settings: UserSettings;
  updateSetting: UpdateSetting;
}

/** Renders cloud synchronization and expandable storage information. */
export function DataSettingsSection({
  isSaving,
  settings,
  updateSetting
}: DataSettingsSectionProps) {
  const [isStorageDetailOpen, setIsStorageDetailOpen] = useState(false);

  return (
    <SettingsSection title="Data & sync">
      <SettingsRow
        control={
          <Switch
            aria-label="Toggle cloud sync"
            checked={settings.cloudSync}
            disabled={isSaving}
            onCheckedChange={(checked) => {
              void updateSetting("cloudSync", checked);
            }}
          />
        }
        description="Keep supported settings and drafts available across signed-in devices."
        icon={Cloud}
        title="Cloud sync"
      />
      <SettingsRow
        control={
          <Switch
            aria-label="Toggle sync over cellular"
            checked={settings.syncOverCellular}
            disabled={isSaving || !settings.cloudSync}
            onCheckedChange={(checked) => {
              void updateSetting("syncOverCellular", checked);
            }}
          />
        }
        description="Allow supported background sync when Wi-Fi is unavailable."
        icon={Signal}
        title="Sync over cellular"
      />
      <SettingsRow
        control={
          <Badge variant={settings.cloudSync ? "success" : "secondary"}>
            {settings.cloudSync ? "Up to date" : "Paused"}
          </Badge>
        }
        description={formatSettingsDateTime(settings.lastSyncedAt)}
        icon={RefreshCcw}
        title="Last sync"
      />
      <SettingsRow
        control={
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-muted-foreground">
              {formatSettingsBytes(settings.storage.usedBytes)}
            </span>
            <Button
              aria-controls="storage-settings-detail"
              aria-expanded={isStorageDetailOpen}
              aria-label="Review storage details"
              onClick={() => setIsStorageDetailOpen((current) => !current)}
              size="icon"
              title="Review storage details"
              type="button"
              variant="ghost"
            >
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 transition-transform",
                  isStorageDetailOpen ? "rotate-180" : null
                )}
              />
            </Button>
          </div>
        }
        description="Review evidence and generated export storage."
        icon={Database}
        title="Manage storage"
      />
      {isStorageDetailOpen ? (
        <dl
          className="grid gap-3 bg-secondary/20 px-4 py-4 sm:grid-cols-3 md:px-5"
          id="storage-settings-detail"
        >
          <StorageMetric
            label="Evidence files"
            value={`${settings.storage.documentCount} · ${formatSettingsBytes(
              settings.storage.documentBytes
            )}`}
          />
          <StorageMetric
            label="Packet exports"
            value={`${settings.storage.exportCount} · ${formatSettingsBytes(
              settings.storage.exportBytes
            )}`}
          />
          <StorageMetric
            label="Total stored"
            value={formatSettingsBytes(settings.storage.usedBytes)}
          />
        </dl>
      ) : null}
    </SettingsSection>
  );
}
