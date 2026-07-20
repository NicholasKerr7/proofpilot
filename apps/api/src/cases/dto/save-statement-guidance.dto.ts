import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

export class SaveStatementGuidanceDto {
  @ApiProperty({ example: "PayPal permanently limited my account." })
  @IsString()
  @MaxLength(500)
  platformAction!: string;

  @ApiProperty({ example: "The limitation began on May 12, 2026." })
  @IsString()
  @MaxLength(160)
  actionDate!: string;

  @ApiProperty({ example: "The notice referred to an account activity review." })
  @IsString()
  @MaxLength(2000)
  reasonGiven!: string;

  @ApiProperty({ example: "I used the account for routine business payments." })
  @IsString()
  @MaxLength(2000)
  accountUse!: string;

  @ApiProperty({ example: "I contacted support twice and supplied the requested records." })
  @IsString()
  @MaxLength(2000)
  supportContact!: string;

  @ApiProperty({ example: "Restore account access after reviewing the attached evidence." })
  @IsString()
  @MaxLength(1200)
  requestedOutcome!: string;

  @ApiProperty({ example: "Restriction notice, support emails, and account ownership records." })
  @IsString()
  @MaxLength(2000)
  supportingDocuments!: string;
}
