import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";
import { SanitizedText } from "../../common/validation/sanitized-text.js";

export class CreatePacketShareCommentDto {
  @ApiProperty({ example: "secure-packet-share-token" })
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  token!: string;

  @ApiProperty({ example: "The transaction summary is clear." })
  @SanitizedText()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}
