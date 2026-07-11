import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";
import {
  supportRequestCategories,
  supportRequestPriorities,
  type SupportRequestCategory,
  type SupportRequestPriority
} from "@proofpilot/types";

export class CreateSupportRequestDto {
  @ApiPropertyOptional({ description: "An active case owned by the current user." })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  caseId?: string;

  @ApiProperty({ enum: supportRequestCategories, example: "CASE_ASSISTANCE" })
  @IsIn(supportRequestCategories)
  category!: SupportRequestCategory;

  @ApiProperty({ example: "Help reviewing missing evidence" })
  @IsString()
  @Matches(/\S/)
  @MinLength(5)
  @MaxLength(160)
  subject!: string;

  @ApiProperty({ example: "I need help understanding which ownership document is missing." })
  @IsString()
  @Matches(/\S/)
  @MinLength(20)
  @MaxLength(5000)
  message!: string;

  @ApiProperty({ enum: supportRequestPriorities, example: "NORMAL" })
  @IsIn(supportRequestPriorities)
  priority!: SupportRequestPriority;
}
