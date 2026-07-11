import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({ maxLength: 120, minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  currentPassword!: string;

  @ApiProperty({ maxLength: 120, minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  newPassword!: string;
}
