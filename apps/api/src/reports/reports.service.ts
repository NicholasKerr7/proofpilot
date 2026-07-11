import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { ReportSummary } from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  buildReportSummary,
  reportCaseSelect,
  toReportCaseSummary
} from "./report-calculations.js";
import {
  buildReportCsv,
  parseReportSections,
  slugifyReportName
} from "./report-csv.js";
import type { ReportExportQueryDto } from "./dto/report-export-query.dto.js";
import type { ReportSummaryQueryDto } from "./dto/report-summary-query.dto.js";

interface CsvReport {
  content: string;
  filename: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(ownerId: string, query: ReportSummaryQueryDto): Promise<ReportSummary> {
    const cases = await this.listOwnedCases(ownerId, {
      ...(query.caseId ? { caseId: query.caseId } : {})
    });

    if (query.caseId && !cases.length) {
      throw new NotFoundException("Case not found.");
    }

    return buildReportSummary(cases, query.caseId ?? null);
  }

  async exportCsv(ownerId: string, query: ReportExportQueryDto): Promise<CsvReport> {
    this.validateDateRange(query.from, query.to);

    const selectedCase = query.caseId
      ? await this.prisma.case.findFirst({
          where: {
            id: query.caseId,
            ownerId,
            archivedAt: null
          },
          select: {
            id: true,
            title: true
          }
        })
      : null;

    if (query.caseId && !selectedCase) {
      throw new NotFoundException("Case not found.");
    }

    const cases = await this.listOwnedCases(ownerId, {
      ...(query.caseId ? { caseId: query.caseId } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {})
    });
    const summaries = cases.map(toReportCaseSummary);
    const sections = parseReportSections(query.sections);
    const content = buildReportCsv(summaries, sections);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = selectedCase
      ? `${slugifyReportName(selectedCase.title)}-report-${dateStamp}.csv`
      : `proofpilot-report-${dateStamp}.csv`;

    await this.prisma.auditLog.create({
      data: {
        userId: ownerId,
        ...(selectedCase ? { caseId: selectedCase.id } : {}),
        action: "report.csv_exported",
        metadata: {
          sections,
          rowCount: summaries.length,
          from: query.from ?? null,
          to: query.to ?? null
        }
      }
    });

    return { content, filename };
  }

  private async listOwnedCases(
    ownerId: string,
    filters: {
      caseId?: string;
      from?: string;
      to?: string;
    }
  ) {
    const activityCreatedAt = getActivityDateFilter(filters.from, filters.to);

    return this.prisma.case.findMany({
      where: {
        ownerId,
        archivedAt: null,
        ...(filters.caseId ? { id: filters.caseId } : {}),
        ...(activityCreatedAt
          ? {
              auditLogs: {
                some: {
                  createdAt: activityCreatedAt
                }
              }
            }
          : {})
      },
      orderBy: { updatedAt: "desc" },
      select: reportCaseSelect
    });
  }

  private validateDateRange(from?: string, to?: string) {
    if ((from && !isValidReportDate(from)) || (to && !isValidReportDate(to))) {
      throw new BadRequestException("Report dates must be valid dates in YYYY-MM-DD format.");
    }

    if (from && to && from > to) {
      throw new BadRequestException("Report start date must be on or before the end date.");
    }
  }
}

function getActivityDateFilter(from?: string, to?: string) {
  if (!from && !to) {
    return undefined;
  }

  return {
    ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {})
  };
}

function isValidReportDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
