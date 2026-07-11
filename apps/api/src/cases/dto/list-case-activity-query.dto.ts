import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  caseActivityCategories,
  type CaseActivityCategory
} from "@proofpilot/types";

export class ListCaseActivityQueryDto {
  @ApiPropertyOptional({ enum: caseActivityCategories, default: "all" })
  @IsOptional()
  @IsIn(caseActivityCategories)
  category: CaseActivityCategory = "all";

  @ApiPropertyOptional({ default: 20, maximum: 50, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @ApiPropertyOptional({ default: 0, maximum: 5000, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5000)
  offset = 0;
}
