import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  Matches
} from "class-validator";
import { resourceIdPattern } from "../../common/validation/resource-id.js";

export class ReorderTimelineEventsDto {
  @ApiProperty({
    description: "Every timeline event ID in the desired display order.",
    type: [String]
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(resourceIdPattern, { each: true })
  eventIds!: string[];
}
