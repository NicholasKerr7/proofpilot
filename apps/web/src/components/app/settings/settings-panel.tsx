"use client";

import { useState, type ReactNode } from "react";
import type {
  UpdateUserSettingsInput,
  UserSettings,
  UserSettingsValues
} from "@proofpilot/types";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Cloud,
  Database,
  FileDown,
  ListFilter,
  Mail,
  MessageSquareText,
  Moon,
  Palette,
  RefreshCcw,
  Save,
  Settings2,
  Signal,
  Trash2,
  Wind,
  type LucideIcon
} from "lucide-react";
import {
  formatSettingsBytes,
  formatSettingsDateTime,
  getNotificationCategorySummary
} from "@/components/app/settings/settings-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  onUpdate: (input: UpdateUserSettingsInput) => Promise<UserSettings>;
  settings: UserSettings | null;
}

type SettingField = keyof UserSettingsValues;
type Notice = {
  tone: "error" | "success";
  text: string;
};

export function SettingsPanel({ onUpdate, settings }: SettingsPanelProps) {
  const [updatingField, setUpdatingField] = useState<SettingField | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isNotificationDetailOpen, setIsNotificationDetailOpen] = useState(false);
  const [isStorageDetailOpen, setIsStorageDetailOpen] = useState(false);

  async function updateSetting<Field extends SettingField>(
    field: Field,
    value: UserSettingsValues[Field]
  ) {
    setUpdatingField(field);
    setNotice(null);

    try {
      await onUpdate({ [field]: value } as UpdateUserSettingsInput);
      setNotice({ tone: "success", text: "Settings saved." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Settings could not be saved."
      });
    } finally {
      setUpdatingField(null);
    }
  }

  if (!settings) {
    return (
      <section aria-labelledby="settings-heading" className="grid gap-5">
        <SettingsHeading />
        <div className="flex min-h-32 items-center gap-3 rounded-md border border-border bg-card px-4 text-sm text-muted-foreground">
          <RefreshCcw aria-hidden="true" className="h-4 w-4 text-primary" />
          Loading settings...
        </div>
      </section>
    );
  }

  const isSaving = updatingField !== null;

  return (
    <section aria-labelledby="settings-heading" className="grid gap-4 md:gap-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <SettingsHeading />
        <div aria-live="polite" className="min-h-7 sm:text-right">
          {isSaving ? <Badge variant="secondary">Saving...</Badge> : null}
          {!isSaving && notice ? (
            <Badge variant={notice.tone === "error" ? "danger" : "success"}>{notice.text}</Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
        <SettingsSection title="App preferences">
        <SettingsRow
          control={
            <Switch
              aria-label="Toggle auto-save"
              checked={settings.autoSave}
              disabled={isSaving}
              onCheckedChange={(checked) => {
                void updateSetting("autoSave", checked);
              }}
            />
          }
          description="Automatically save supported case and evidence changes."
          icon={Save}
          title="Auto-save"
        />
        <SettingsRow
          control={
            <Switch
              aria-label="Toggle delete confirmations"
              checked={settings.confirmBeforeDelete}
              disabled={isSaving}
              onCheckedChange={(checked) => {
                void updateSetting("confirmBeforeDelete", checked);
              }}
            />
          }
          description="Ask before archiving cases or deleting stored evidence."
          icon={Trash2}
          title="Confirm before delete"
        />
        <SettingsRow
          control={
            <Select
              aria-label="Default case status"
              className="sm:w-48"
              disabled={isSaving}
              onChange={(event) => {
                void updateSetting(
                  "defaultCaseStatus",
                  event.target.value as UserSettingsValues["defaultCaseStatus"]
                );
              }}
              value={settings.defaultCaseStatus}
            >
              <option value="DRAFT">Draft</option>
              <option value="COLLECTING_EVIDENCE">Collecting evidence</option>
            </Select>
          }
          description="Set the starting status for newly created cases."
          icon={CalendarDays}
          title="Default case status"
        />
        <SettingsRow
          control={
            <Select
              aria-label="Items per page"
              className="sm:w-32"
              disabled={isSaving}
              onChange={(event) => {
                void updateSetting(
                  "itemsPerPage",
                  Number(event.target.value) as UserSettingsValues["itemsPerPage"]
                );
              }}
              value={settings.itemsPerPage}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </Select>
          }
          description="Choose how many cases appear on each list page."
          icon={ListFilter}
          title="Items per page"
        />
        </SettingsSection>

        <SettingsSection title="Notifications">
        <SettingsRow
          control={
            <Switch
              aria-label="Toggle email notifications"
              checked={settings.emailNotifications}
              disabled={isSaving}
              onCheckedChange={(checked) => {
                void updateSetting("emailNotifications", checked);
              }}
            />
          }
          description="Receive email updates about your cases and activity."
          icon={Mail}
          title="Email notifications"
        />
        <SettingsRow
          control={
            <Switch
              aria-label="Toggle in-app notifications"
              checked={settings.inAppNotifications}
              disabled={isSaving}
              onCheckedChange={(checked) => {
                void updateSetting("inAppNotifications", checked);
              }}
            />
          }
          description="Show case updates, reminders, and processing alerts in Inbox."
          icon={Bell}
          title="In-app notifications"
        />
        <SettingsRow
          control={
            <Button
              aria-controls="notification-category-settings"
              aria-expanded={isNotificationDetailOpen}
              aria-label="Edit notification categories"
              disabled={isSaving}
              onClick={() => setIsNotificationDetailOpen((current) => !current)}
              size="icon"
              title="Edit notification categories"
              type="button"
              variant="ghost"
            >
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 transition-transform",
                  isNotificationDetailOpen ? "rotate-180" : null
                )}
              />
            </Button>
          }
          description={getNotificationCategorySummary(settings)}
          icon={MessageSquareText}
          title="Notify me about"
        />
        {isNotificationDetailOpen ? (
          <div
            className="grid gap-1 bg-secondary/20 px-3 py-3 sm:grid-cols-2 sm:px-4 md:px-5"
            id="notification-category-settings"
          >
            <CompactSwitch
              checked={settings.notifyCaseUpdates}
              disabled={isSaving}
              label="Case status updates"
              onCheckedChange={(checked) => {
                void updateSetting("notifyCaseUpdates", checked);
              }}
            />
            <CompactSwitch
              checked={settings.notifyDeadlineReminders}
              disabled={isSaving}
              label="Deadlines and reminders"
              onCheckedChange={(checked) => {
                void updateSetting("notifyDeadlineReminders", checked);
              }}
            />
            <CompactSwitch
              checked={settings.notifyEvidenceProcessing}
              disabled={isSaving}
              label="Evidence processing"
              onCheckedChange={(checked) => {
                void updateSetting("notifyEvidenceProcessing", checked);
              }}
            />
            <CompactSwitch
              checked={settings.notifyPacketReady}
              disabled={isSaving}
              label="Packet ready"
              onCheckedChange={(checked) => {
                void updateSetting("notifyPacketReady", checked);
              }}
            />
          </div>
        ) : null}
        </SettingsSection>

        <SettingsSection title="Appearance">
        <SettingsRow
          control={
            <Select
              aria-label="Theme"
              className="sm:w-40"
              disabled={isSaving}
              onChange={(event) => {
                void updateSetting("theme", event.target.value as UserSettingsValues["theme"]);
              }}
              value={settings.theme}
            >
              <option value="DARK">Dark</option>
              <option value="LIGHT">Light</option>
              <option value="SYSTEM">System</option>
            </Select>
          }
          description="Choose the app color scheme used on this device."
          icon={Moon}
          title="Theme"
        />
        <SettingsRow
          control={
            <div className="flex items-center gap-2 sm:w-48">
              <span
                aria-hidden="true"
                className={cn(
                  "h-3 w-3 shrink-0 rounded-full",
                  getAccentSwatchClassName(settings.accentColor)
                )}
              />
              <Select
                aria-label="Accent color"
                disabled={isSaving}
                onChange={(event) => {
                  void updateSetting(
                    "accentColor",
                    event.target.value as UserSettingsValues["accentColor"]
                  );
                }}
                value={settings.accentColor}
              >
                <option value="COPPER">Copper</option>
                <option value="CHAMPAGNE">Champagne</option>
                <option value="TEAL">Teal</option>
              </Select>
            </div>
          }
          description="Select the interface accent used for actions and status cues."
          icon={Palette}
          title="Accent color"
        />
        <SettingsRow
          control={
            <Switch
              aria-label="Toggle reduced motion"
              checked={settings.reduceMotion}
              disabled={isSaving}
              onCheckedChange={(checked) => {
                void updateSetting("reduceMotion", checked);
              }}
            />
          }
          description="Minimize animations and smooth scrolling throughout the app."
          icon={Wind}
          title="Reduce motion"
        />
        </SettingsSection>

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
              value={`${settings.storage.documentCount} · ${formatSettingsBytes(settings.storage.documentBytes)}`}
            />
            <StorageMetric
              label="Packet exports"
              value={`${settings.storage.exportCount} · ${formatSettingsBytes(settings.storage.exportBytes)}`}
            />
            <StorageMetric
              label="Total stored"
              value={formatSettingsBytes(settings.storage.usedBytes)}
            />
          </dl>
        ) : null}
        </SettingsSection>

        <SettingsSection title="Default export format">
        <SettingsRow
          control={
            <Select
              aria-label="Default export format"
              className="sm:w-36"
              disabled={isSaving}
              onChange={(event) => {
                void updateSetting(
                  "exportFormat",
                  event.target.value as UserSettingsValues["exportFormat"]
                );
              }}
              value={settings.exportFormat}
            >
              <option value="PDF">PDF</option>
              <option value="CSV">CSV</option>
            </Select>
          }
          description="Choose the initial format offered by export tools."
          icon={FileDown}
          title="Export format"
        />
        </SettingsSection>
      </div>
    </section>
  );
}

function SettingsHeading() {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Settings2 aria-hidden="true" className="h-4 w-4" />
        Workspace controls
      </p>
      <h1 className="mt-1 text-2xl font-semibold sm:text-3xl" id="settings-heading">
        Settings
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Manage app preferences, notifications, appearance, and data settings.
      </p>
    </div>
  );
}

function SettingsSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <h2 className="border-b border-border px-3 py-3 text-xs font-semibold uppercase text-primary sm:px-4 md:px-5">
        {title}
      </h2>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function SettingsRow({
  control,
  description,
  icon: Icon,
  title
}: {
  control: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="grid min-h-20 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-4 md:px-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      <span className="col-span-2 flex min-w-0 justify-end sm:col-span-1">{control}</span>
    </div>
  );
}

function CompactSwitch({
  checked,
  disabled,
  label,
  onCheckedChange
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-2 py-2">
      <span className="text-sm text-foreground">{label}</span>
      <Switch
        aria-label={`Toggle ${label.toLowerCase()}`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function StorageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function getAccentSwatchClassName(accentColor: UserSettings["accentColor"]) {
  if (accentColor === "CHAMPAGNE") {
    return "bg-amber-200";
  }

  if (accentColor === "TEAL") {
    return "bg-teal-400";
  }

  return "bg-orange-500";
}
