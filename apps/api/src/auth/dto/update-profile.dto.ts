import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class UpdateProfileDto {
  @ApiProperty({ example: "Nicholas Kerr", maxLength: 120, minLength: 1 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/\S/, { message: "name must contain at least one non-whitespace character" })
  name!: string;
}
