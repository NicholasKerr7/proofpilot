import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateInboxReadStateDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  read!: boolean;
}
