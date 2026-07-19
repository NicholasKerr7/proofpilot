import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional } from "class-validator";
import {
  caseInvitationExpiryOptions,
  type CaseInvitationExpiryDays
} from "@proofpilot/types";

export class UpdateCaseCollaborationSettingsDto {
  @ApiPropertyOptional({ enum: caseInvitationExpiryOptions, example: 7 })
  @IsOptional()
  @IsIn(caseInvitationExpiryOptions)
  invitationExpiryDays?: CaseInvitationExpiryDays;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  preventDownloads?: boolean;
}
