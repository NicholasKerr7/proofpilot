import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsIn } from "class-validator";
import { helpArticleSlugs, type HelpArticleSlug } from "@proofpilot/types";

export class RecordArticleFeedbackDto {
  @ApiProperty({ enum: helpArticleSlugs, example: "upload-evidence" })
  @IsIn(helpArticleSlugs)
  articleSlug!: HelpArticleSlug;

  @ApiProperty({ example: true })
  @IsBoolean()
  helpful!: boolean;
}
