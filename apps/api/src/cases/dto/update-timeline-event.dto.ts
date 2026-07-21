import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";
import { resourceIdPattern } from "../../common/validation/resource-id.js";
import { SanitizedText } from "../../common/validation/sanitized-text.js";

export class UpdateTimelineEventDto {
  @ApiPropertyOptional({ example: "2026-07-02T12:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional({ example: "Account closure notice received" })
  @IsOptional()
  @SanitizedText({ singleLine: true })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({
    example: "The platform sent a closure notice after an account review.",
    nullable: true
  })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    description: "Evidence documents from this case that support the event.",
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(resourceIdPattern, { each: true })
  documentIds?: string[];
}
