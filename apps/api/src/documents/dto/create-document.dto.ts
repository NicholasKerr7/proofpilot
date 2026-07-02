import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsMimeType, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateDocumentDto {
  @ApiProperty({ example: "closure-notice.png" })
  @IsString()
  @MaxLength(240)
  originalName!: string;

  @ApiProperty({ example: "image/png" })
  @IsMimeType()
  @MaxLength(120)
  mimeType!: string;

  @ApiProperty({ example: 348112 })
  @IsInt()
  @Min(1)
  @Max(25 * 1024 * 1024)
  byteSize!: number;
}
