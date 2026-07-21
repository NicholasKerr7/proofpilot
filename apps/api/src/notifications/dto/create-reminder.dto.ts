import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";
import { SanitizedText } from "../../common/validation/sanitized-text.js";

export class CreateReminderDto {
  @ApiProperty({ example: "2026-07-20T12:00:00.000Z" })
  @IsDateString()
  remindAt!: string;

  @ApiPropertyOptional({ example: "Review the appeal packet before the platform deadline." })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @Matches(/\S/)
  @MinLength(1)
  @MaxLength(500)
  message?: string;
}
