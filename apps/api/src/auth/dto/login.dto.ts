import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "owner@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: "replace-me-strongly" })
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  password!: string;
}
