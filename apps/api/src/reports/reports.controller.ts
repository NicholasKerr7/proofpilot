import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiProduces, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard.js";
import type { RequestUser } from "../common/types/request-user.js";
import { ReportExportQueryDto } from "./dto/report-export-query.dto.js";
import { ReportSummaryQueryDto } from "./dto/report-summary-query.dto.js";
import { ReportsService } from "./reports.service.js";

@ApiTags("reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("summary")
  getSummary(@CurrentUser() user: RequestUser, @Query() query: ReportSummaryQueryDto) {
    return this.reportsService.getSummary(user.id, query);
  }

  @Get("export")
  @ApiProduces("text/csv")
  async exportCsv(
    @CurrentUser() user: RequestUser,
    @Query() query: ReportExportQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const report = await this.reportsService.exportCsv(user.id, query);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${report.filename}"`);
    response.setHeader("Cache-Control", "no-store");
    return report.content;
  }
}
