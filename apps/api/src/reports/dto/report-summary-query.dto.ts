import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ReportSummaryQueryDto {
  @ApiPropertyOptional({ description: "Restrict analytics to one owned case." })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  caseId?: string;
}
