import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({ maxLength: 128, minLength: 32 })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9_-]+$/)
  token!: string;

  @ApiProperty({ maxLength: 120, minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  newPassword!: string;
}
