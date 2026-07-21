import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";
import { SanitizedText } from "../../common/validation/sanitized-text.js";

export class SaveStatementDto {
  @ApiProperty({
    example:
      "I am requesting a review of the account restriction and have attached evidence showing account ownership, activity context, and support history."
  })
  @SanitizedText()
  @IsString()
  @MinLength(1)
  @MaxLength(12000)
  content!: string;
}
