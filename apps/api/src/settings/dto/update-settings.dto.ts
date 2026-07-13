import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  accentColorOptions,
  appThemeOptions,
  defaultCaseStatusOptions,
  exportFormatOptions,
  itemsPerPageOptions
} from "@proofpilot/types";
import { IsBoolean, IsIn, IsInt, IsOptional } from "class-validator";

export class UpdateSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSave?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  confirmBeforeDelete?: boolean;

  @ApiPropertyOptional({ enum: defaultCaseStatusOptions })
  @IsOptional()
  @IsIn(defaultCaseStatusOptions)
  defaultCaseStatus?: (typeof defaultCaseStatusOptions)[number];

  @ApiPropertyOptional({ enum: itemsPerPageOptions })
  @IsOptional()
  @IsInt()
  @IsIn(itemsPerPageOptions)
  itemsPerPage?: (typeof itemsPerPageOptions)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inAppNotifications?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyCaseUpdates?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyDeadlineReminders?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyEvidenceProcessing?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyPacketReady?: boolean;

  @ApiPropertyOptional({ enum: appThemeOptions })
  @IsOptional()
  @IsIn(appThemeOptions)
  theme?: (typeof appThemeOptions)[number];

  @ApiPropertyOptional({ enum: accentColorOptions })
  @IsOptional()
  @IsIn(accentColorOptions)
  accentColor?: (typeof accentColorOptions)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reduceMotion?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  cloudSync?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncOverCellular?: boolean;

  @ApiPropertyOptional({ enum: exportFormatOptions })
  @IsOptional()
  @IsIn(exportFormatOptions)
  exportFormat?: (typeof exportFormatOptions)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  analyticsUsageData?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  marketingCommunications?: boolean;
}
