import type { UserSettingsValues } from "@proofpilot/types";

export type SettingField = keyof UserSettingsValues;

export type UpdateSetting = <Field extends SettingField>(
  field: Field,
  value: UserSettingsValues[Field]
) => Promise<void>;
