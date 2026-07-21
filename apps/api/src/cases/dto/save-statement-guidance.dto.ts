import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";
import { SanitizedText } from "../../common/validation/sanitized-text.js";

export class SaveStatementGuidanceDto {
  @ApiProperty({ example: "PayPal permanently limited my account." })
  @SanitizedText()
  @IsString()
  @MaxLength(500)
  platformAction!: string;

  @ApiProperty({ example: "The limitation began on May 12, 2026." })
  @SanitizedText({ singleLine: true })
  @IsString()
  @MaxLength(160)
  actionDate!: string;

  @ApiProperty({ example: "The notice referred to an account activity review." })
  @SanitizedText()
  @IsString()
  @MaxLength(2000)
  reasonGiven!: string;

  @ApiProperty({ example: "I used the account for routine business payments." })
  @SanitizedText()
  @IsString()
  @MaxLength(2000)
  accountUse!: string;

  @ApiProperty({ example: "I contacted support twice and supplied the requested records." })
  @SanitizedText()
  @IsString()
  @MaxLength(2000)
  supportContact!: string;

  @ApiProperty({ example: "Restore account access after reviewing the attached evidence." })
  @SanitizedText()
  @IsString()
  @MaxLength(1200)
  requestedOutcome!: string;

  @ApiProperty({ example: "Restriction notice, support emails, and account ownership records." })
  @SanitizedText()
  @IsString()
  @MaxLength(2000)
  supportingDocuments!: string;
}
