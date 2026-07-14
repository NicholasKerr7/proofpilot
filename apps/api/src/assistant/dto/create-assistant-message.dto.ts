import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";
import type { CreateAssistantMessageInput } from "@proofpilot/types";

export class CreateAssistantMessageDto implements CreateAssistantMessageInput {
  @ApiProperty({
    example: "What evidence am I missing?",
    maxLength: 2000,
    minLength: 2
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Matches(/\S/)
  @MinLength(2)
  @MaxLength(2000)
  content!: string;
}
