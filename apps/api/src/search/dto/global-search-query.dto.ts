import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";
import {
  globalSearchResultTypes,
  globalSearchSortOptions,
  globalSearchStatusFilters,
  type GlobalSearchSort,
  type GlobalSearchStatusFilter
} from "@proofpilot/types";

const searchDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const searchTypesPattern = new RegExp(
  `^(${globalSearchResultTypes.join("|")})(,(${globalSearchResultTypes.join("|")}))*$`
);

export class GlobalSearchQueryDto {
  @ApiPropertyOptional({ example: "PayPal" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

  @ApiPropertyOptional({ description: "Restrict results to one owned case." })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  caseId?: string;

  @ApiPropertyOptional({ example: "CASE,DOCUMENT,TIMELINE" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Matches(searchTypesPattern)
  types?: string;

  @ApiPropertyOptional({ example: "2026-06-01" })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(searchDatePattern)
  from?: string;

  @ApiPropertyOptional({ example: "2026-07-11" })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(searchDatePattern)
  to?: string;

  @ApiPropertyOptional({ enum: globalSearchStatusFilters, example: "ALL" })
  @IsOptional()
  @IsIn(globalSearchStatusFilters)
  status?: GlobalSearchStatusFilter;

  @ApiPropertyOptional({ enum: globalSearchSortOptions, example: "RELEVANCE" })
  @IsOptional()
  @IsIn(globalSearchSortOptions)
  sort?: GlobalSearchSort;

  @ApiPropertyOptional({ enum: ["true", "false"], example: "false" })
  @IsOptional()
  @IsIn(["true", "false"])
  includeArchived?: string;

  @ApiPropertyOptional({ default: 8, maximum: 50, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
