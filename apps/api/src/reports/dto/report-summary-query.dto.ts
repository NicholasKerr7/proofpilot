import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { resourceIdPattern } from "../../common/validation/resource-id.js";

export class ReportSummaryQueryDto {
  @ApiPropertyOptional({ description: "Restrict analytics to one owned case." })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(resourceIdPattern)
  caseId?: string;
}
