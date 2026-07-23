import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  appealSubmissionStatuses,
  submissionUpdateTypes,
  type AppealSubmissionStatus,
  type SubmissionUpdateType
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

export class CreateSubmissionUpdateDto {
  @ApiProperty({ enum: submissionUpdateTypes, example: "ACKNOWLEDGEMENT" })
  @IsIn(submissionUpdateTypes)
  type!: SubmissionUpdateType;

  @ApiProperty({ example: "PayPal confirmed receipt" })
  @SanitizedText({ singleLine: true })
  @IsString()
  @Matches(/\S/)
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({ example: "The appeal is queued for account review." })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @Matches(/\S/)
  @MaxLength(2000)
  details?: string;

  @ApiProperty({ example: "2026-05-13T10:00:00.000Z" })
  @IsDateString()
  occurredAt!: string;

  @ApiPropertyOptional({ enum: appealSubmissionStatuses, example: "ACKNOWLEDGED" })
  @IsOptional()
  @IsIn(appealSubmissionStatuses)
  status?: AppealSubmissionStatus;

  @ApiPropertyOptional({ example: "2026-05-27T10:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  responseDueAt?: string;
}
