import type { UserSettings, UserSettingsValues } from "@proofpilot/types";
import {
  CalendarDays,
  FileDown,
  ListFilter,
  Moon,
  Palette,
  Save,
  Trash2,
  Wind
} from "lucide-react";
import {
  SettingsRow,
  SettingsSection
} from "@/components/app/settings/settings-controls";
import type { UpdateSetting } from "@/components/app/settings/settings-types";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface PreferenceSectionProps {
  isSaving: boolean;
  settings: UserSettings;
  updateSetting: UpdateSetting;
}

/** Renders case-list and destructive-action workspace preferences. */
export function AppPreferencesSection({
  isSaving,
  settings,
  updateSetting
}: PreferenceSectionProps) {
  return (
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
  );
}

/** Renders theme, accent, and motion preferences. */
export function AppearanceSection({
  isSaving,
  settings,
  updateSetting
}: PreferenceSectionProps) {
  return (
    <SettingsSection title="Appearance">
      <SettingsRow
        control={
          <Select
            aria-label="Theme"
            className="sm:w-40"
            disabled={isSaving}
            onChange={(event) => {
              void updateSetting(
                "theme",
                event.target.value as UserSettingsValues["theme"]
              );
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
  );
}

/** Renders the default packet export format preference. */
export function ExportFormatSection({
  isSaving,
  settings,
  updateSetting
}: PreferenceSectionProps) {
  return (
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
  );
}

/** Maps the accent enum to its visible swatch color. */
function getAccentSwatchClassName(accentColor: UserSettings["accentColor"]) {
  if (accentColor === "CHAMPAGNE") {
    return "bg-amber-200";
  }

  if (accentColor === "TEAL") {
    return "bg-teal-400";
  }

  return "bg-orange-500";
}
