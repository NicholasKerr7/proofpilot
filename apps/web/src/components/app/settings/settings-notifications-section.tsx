"use client";

import { useState } from "react";
import type { UserSettings } from "@proofpilot/types";
import {
  Bell,
  ChevronDown,
  Mail,
  MessageSquareText
} from "lucide-react";
import {
  CompactSwitch,
  SettingsRow,
  SettingsSection
} from "@/components/app/settings/settings-controls";
import type { UpdateSetting } from "@/components/app/settings/settings-types";
import { getNotificationCategorySummary } from "@/components/app/settings/settings-utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface NotificationSettingsSectionProps {
  isSaving: boolean;
  settings: UserSettings;
  updateSetting: UpdateSetting;
}

/** Renders notification channels and their expandable category controls. */
export function NotificationSettingsSection({
  isSaving,
  settings,
  updateSetting
}: NotificationSettingsSectionProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  return (
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
            aria-expanded={isDetailOpen}
            aria-label="Edit notification categories"
            disabled={isSaving}
            onClick={() => setIsDetailOpen((current) => !current)}
            size="icon"
            title="Edit notification categories"
            type="button"
            variant="ghost"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "h-4 w-4 transition-transform",
                isDetailOpen ? "rotate-180" : null
              )}
            />
          </Button>
        }
        description={getNotificationCategorySummary(settings)}
        icon={MessageSquareText}
        title="Notify me about"
      />
      {isDetailOpen ? (
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
  );
}
