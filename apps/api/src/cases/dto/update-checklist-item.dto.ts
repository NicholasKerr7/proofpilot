import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateChecklistItemDto {
  @ApiProperty({
    description: "Whether the user has explicitly completed this checklist item.",
    example: true
  })
  @IsBoolean()
  completed!: boolean;
}
