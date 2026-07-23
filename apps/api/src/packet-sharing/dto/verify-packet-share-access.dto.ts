import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class VerifyPacketShareAccessDto {
  @ApiProperty({ example: "secure-packet-share-token" })
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  token!: string;

  @ApiProperty({ example: "advisor@example.com" })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: "challenge-id" })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  challengeId!: string;

  @ApiProperty({ example: "482901" })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
