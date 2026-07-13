"use client";

import { useState } from "react";
import type {
  UpdateUserSettingsInput,
  UserSettings,
  UserSettingsValues
} from "@proofpilot/types";
import { Eye, Mail, ShieldX, TimerReset, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

type PrivacyField = "analyticsUsageData" | "marketingCommunications";

interface SecurityPrivacyControlsProps {
  onOpenHelp: () => void;
  onUpdate: (input: UpdateUserSettingsInput) => Promise<UserSettings>;
  settings: UserSettings | null;
}

export function SecurityPrivacyControls({
  onOpenHelp,
  onUpdate,
  settings
}: SecurityPrivacyControlsProps) {
  const [updatingField, setUpdatingField] = useState<PrivacyField | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function updatePrivacy<Field extends PrivacyField>(
    field: Field,
    value: UserSettingsValues[Field]
  ) {
    setUpdatingField(field);
    setNotice(null);

    try {
      await onUpdate({ [field]: value });
      setNotice({ tone: "success", text: "Privacy preference saved." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Privacy preference could not be saved."
      });
    } finally {
      setUpdatingField(null);
    }
  }

  return (
    <section aria-labelledby="privacy-controls-heading" className="rounded-md border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase text-primary" id="privacy-controls-heading">
          Privacy controls
        </h2>
        {updatingField ? <Badge variant="secondary">Saving...</Badge> : null}
        {!updatingField && notice ? (
          <Badge variant={notice.tone === "error" ? "danger" : "success"}>{notice.text}</Badge>
        ) : null}
      </div>

      <div className="mt-3 divide-y divide-border border-y border-border">
        <PrivacyRow
          checked={settings?.analyticsUsageData ?? false}
          description="Record consent for anonymous product analytics. No analytics provider is currently configured."
          disabled={!settings || updatingField !== null}
          icon={Eye}
          label="Analytics & usage data"
          onCheckedChange={(checked) => {
            void updatePrivacy("analyticsUsageData", checked);
          }}
        />
        <PrivacyRow
          checked={settings?.marketingCommunications ?? false}
          description="Allow optional product updates and promotional email."
          disabled={!settings || updatingField !== null}
          icon={Mail}
          label="Marketing communications"
          onCheckedChange={(checked) => {
            void updatePrivacy("marketingCommunications", checked);
          }}
        />
        <PrivacyRow
          checked={false}
          description="Available after shared team workspaces and access roles are implemented."
          disabled
          icon={ShieldX}
          label="Case activity visibility"
          onCheckedChange={() => undefined}
        />
        <PrivacyRow
          checked={false}
          description="Automatic closed-case deletion is not configured. Cases remain owner controlled."
          disabled
          icon={TimerReset}
          label="Automatic data retention"
          onCheckedChange={() => undefined}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 text-xs leading-5 text-muted-foreground">
        <span>Review how ProofPilot handles account and case information.</span>
        <Button className="h-11 px-2 text-primary" onClick={onOpenHelp} type="button" variant="ghost">
          Privacy guidance
        </Button>
      </div>
    </section>
  );
}

interface PrivacyRowProps {
  checked: boolean;
  description: string;
  disabled: boolean;
  icon: LucideIcon;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}

function PrivacyRow({
  checked,
  description,
  disabled,
  icon: Icon,
  label,
  onCheckedChange
}: PrivacyRowProps) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <Switch
        aria-label={`Toggle ${label.toLowerCase()}`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
