import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { SanitizedText } from "../../common/validation/sanitized-text.js";

export class CreateCaseDto {
  @ApiProperty({ example: "PayPal account closure appeal" })
  @SanitizedText({ singleLine: true })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @ApiProperty({ example: "PayPal" })
  @SanitizedText({ singleLine: true })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  platform!: string;

  @ApiPropertyOptional({
    example: "Account was closed after a payment review and I need to submit evidence."
  })
  @IsOptional()
  @SanitizedText()
  @IsString()
  @MaxLength(2000)
  summary?: string;

  @ApiPropertyOptional({ example: "2026-07-20T12:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ example: "account-ban-appeal" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  caseTypeSlug?: string;
}
