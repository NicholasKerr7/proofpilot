import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  appealSubmissionChannels,
  type AppealSubmissionChannel
} from "@proofpilot/types";
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";
import { SanitizedText } from "../../common/validation/sanitized-text.js";

export class CreateCaseSubmissionDto {
  @ApiProperty({ enum: appealSubmissionChannels, example: "WEB_PORTAL" })
  @IsIn(appealSubmissionChannels)
  channel!: AppealSubmissionChannel;

  @ApiProperty({ example: "PayPal Resolution Center" })
  @SanitizedText({ singleLine: true })
  @IsString()
  @Matches(/\S/)
  @MinLength(2)
  @MaxLength(160)
  destination!: string;

  @ApiProperty({ example: "2026-05-12T15:22:00.000Z" })
  @IsDateString()
  submittedAt!: string;

  @ApiPropertyOptional({ example: "PP-2026-0147" })
  @IsOptional()
  @SanitizedText({ singleLine: true })
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  confirmationCode?: string;

  @ApiPropertyOptional({ example: "2026-05-26T15:22:00.000Z" })
  @IsOptional()
  @IsDateString()
  responseDueAt?: string;

  @ApiPropertyOptional({ example: "Submitted through the permanent limitation appeal form." })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @Matches(/\S/)
  @MaxLength(2000)
  notes?: string;
}
