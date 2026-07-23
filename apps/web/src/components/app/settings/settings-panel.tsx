"use client";

import { useState } from "react";
import type {
  UpdateUserSettingsInput,
  UserSettings,
  UserSettingsValues
} from "@proofpilot/types";
import { RefreshCcw, Settings2 } from "lucide-react";
import { DataSettingsSection } from "@/components/app/settings/settings-data-section";
import { NotificationSettingsSection } from "@/components/app/settings/settings-notifications-section";
import {
  AppPreferencesSection,
  AppearanceSection,
  ExportFormatSection
} from "@/components/app/settings/settings-preference-sections";
import type { SettingField } from "@/components/app/settings/settings-types";
import { Badge } from "@/components/ui/badge";

interface SettingsPanelProps {
  onUpdate: (input: UpdateUserSettingsInput) => Promise<UserSettings>;
  settings: UserSettings | null;
}

interface Notice {
  tone: "error" | "success";
  text: string;
}

/** Coordinates settings persistence and composes independent settings domains. */
export function SettingsPanel({ onUpdate, settings }: SettingsPanelProps) {
  const [updatingField, setUpdatingField] = useState<SettingField | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  /** Persists one typed settings field and reports its save state. */
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
  const sectionProps = { isSaving, settings, updateSetting };

  return (
    <section aria-labelledby="settings-heading" className="grid gap-4 md:gap-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <SettingsHeading />
        <div aria-live="polite" className="min-h-7 sm:text-right">
          {isSaving ? <Badge variant="secondary">Saving...</Badge> : null}
          {!isSaving && notice ? (
            <Badge variant={notice.tone === "error" ? "danger" : "success"}>
              {notice.text}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
        <AppPreferencesSection {...sectionProps} />
        <NotificationSettingsSection {...sectionProps} />
        <AppearanceSection {...sectionProps} />
        <DataSettingsSection {...sectionProps} />
        <ExportFormatSection {...sectionProps} />
      </div>
    </section>
  );
}

/** Renders the settings page identity and summary. */
function SettingsHeading() {
  return (
    <div className="proof-page-header">
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
