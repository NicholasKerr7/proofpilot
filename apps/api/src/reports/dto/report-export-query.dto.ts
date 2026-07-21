import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";
import { reportExportSections } from "@proofpilot/types";
import { resourceIdPattern } from "../../common/validation/resource-id.js";

const reportDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const reportSectionsPattern = new RegExp(
  `^(${reportExportSections.join("|")})(,(${reportExportSections.join("|")}))*$`
);

export class ReportExportQueryDto {
  @ApiPropertyOptional({ description: "Restrict the export to one owned case." })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(resourceIdPattern)
  caseId?: string;

  @ApiPropertyOptional({ example: "2026-06-01" })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(reportDatePattern)
  from?: string;

  @ApiPropertyOptional({ example: "2026-06-30" })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(reportDatePattern)
  to?: string;

  @ApiPropertyOptional({
    example: "overview,evidence,timeline",
    description: "Comma-separated report sections."
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Matches(reportSectionsPattern)
  sections?: string;
}
