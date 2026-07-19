import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class CreatePacketShareCommentDto {
  @ApiProperty({ example: "secure-packet-share-token" })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;

  @ApiProperty({ example: "The transaction summary is clear." })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
