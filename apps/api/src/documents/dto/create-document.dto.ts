import { ApiProperty } from "@nestjs/swagger";
import {
  evidenceMaxUploadByteSize,
  evidenceSources,
  type EvidenceSource
} from "@proofpilot/types/evidence";
import {
  IsIn,
  IsInt,
  IsMimeType,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import { SanitizedText } from "../../common/validation/sanitized-text.js";

export class CreateDocumentDto {
  @ApiProperty({ example: "closure-notice.png" })
  @SanitizedText({ singleLine: true })
  @IsString()
  @Matches(/\S/)
  @MinLength(1)
  @MaxLength(240)
  originalName!: string;

  @ApiProperty({ example: "image/png" })
  @IsMimeType()
  @MaxLength(120)
  mimeType!: string;

  @ApiProperty({ example: 348112 })
  @IsInt()
  @Min(1)
  @Max(evidenceMaxUploadByteSize)
  byteSize!: number;

  @ApiProperty({ enum: evidenceSources, example: "FILE_UPLOAD", required: false })
  @IsOptional()
  @IsIn(evidenceSources)
  source?: EvidenceSource;
}
