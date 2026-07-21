import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";
import type { CreateAssistantMessageInput } from "@proofpilot/types";
import { SanitizedText } from "../../common/validation/sanitized-text.js";

export class CreateAssistantMessageDto implements CreateAssistantMessageInput {
  @ApiProperty({
    example: "What evidence am I missing?",
    maxLength: 2000,
    minLength: 2
  })
  @SanitizedText()
  @IsString()
  @Matches(/\S/)
  @MinLength(2)
  @MaxLength(2000)
  content!: string;
}
