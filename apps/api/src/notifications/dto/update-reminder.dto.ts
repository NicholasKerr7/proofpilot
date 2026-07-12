import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";

export class UpdateReminderDto {
  @ApiPropertyOptional({ example: "2026-07-22T14:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  remindAt?: string;

  @ApiPropertyOptional({ example: "Review the appeal packet before the platform deadline." })
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MinLength(1)
  @MaxLength(500)
  message?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
