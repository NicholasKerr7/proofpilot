import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "owner@example.com" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: "Case Owner" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiProperty({ minLength: 8, example: "replace-me-strongly" })
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  password!: string;
}
