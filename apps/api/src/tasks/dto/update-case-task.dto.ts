import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  caseTaskPriorities,
  caseTaskStatuses,
  type CaseTaskPriority,
  type CaseTaskStatus
} from "@proofpilot/types";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { SanitizedText } from "../../common/validation/sanitized-text.js";

export class UpdateCaseTaskDto {
  @ApiPropertyOptional({ example: "Upload proof of identity" })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @Matches(/\S/)
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ example: "Provide a valid government-issued ID.", nullable: true })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @Matches(/\S/)
  @MinLength(1)
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ enum: caseTaskPriorities, example: "HIGH" })
  @IsOptional()
  @IsIn(caseTaskPriorities)
  priority?: CaseTaskPriority;

  @ApiPropertyOptional({ enum: caseTaskStatuses, example: "IN_PROGRESS" })
  @IsOptional()
  @IsIn(caseTaskStatuses)
  status?: CaseTaskStatus;

  @ApiPropertyOptional({ example: "2026-08-01T12:00:00.000Z", nullable: true })
  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @ApiPropertyOptional({ example: 50, maximum: 100, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;
}
