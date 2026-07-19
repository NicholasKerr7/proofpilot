import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class PacketShareTokenDto {
  @ApiProperty({ example: "secure-packet-share-token" })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;
}
