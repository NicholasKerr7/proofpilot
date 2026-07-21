import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";
import { SanitizedText } from "../../common/validation/sanitized-text.js";

export class CreateSupportRequestMessageDto {
  @ApiProperty({ example: "The issue also occurs when I upload a PDF from Safari." })
  @SanitizedText()
  @IsString()
  @Matches(/\S/)
  @MinLength(2)
  @MaxLength(5000)
  message!: string;
}
