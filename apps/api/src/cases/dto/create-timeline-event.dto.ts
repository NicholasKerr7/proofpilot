import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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

export class CreateTimelineEventDto {
  @ApiProperty({ example: "2026-07-02T12:00:00.000Z" })
  @IsDateString()
  occurredAt!: string;

  @ApiProperty({ example: "Account closure notice received" })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({
    example: "The platform sent a closure notice after an account review.",
    nullable: true
  })
  @IsOptional()
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
