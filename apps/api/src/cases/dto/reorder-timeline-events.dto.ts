import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsString } from "class-validator";

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
  eventIds!: string[];
}
