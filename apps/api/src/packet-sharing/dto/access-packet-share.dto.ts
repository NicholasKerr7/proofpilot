import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class AccessPacketShareDto {
  @ApiProperty({ example: "secure-packet-share-token" })
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  token!: string;

  @ApiProperty({ example: "advisor@example.com" })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
