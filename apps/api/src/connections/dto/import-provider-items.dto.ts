import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  Matches,
  MaxLength
} from "class-validator";

export class ImportProviderItemsDto {
  @ApiProperty({
    example: ["gmail-limitation-notice", "gmail-support-follow-up"],
    maxItems: 10,
    minItems: 1,
    type: [String]
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  @Matches(/^[a-z0-9-]+$/, { each: true })
  itemIds!: string[];
}
