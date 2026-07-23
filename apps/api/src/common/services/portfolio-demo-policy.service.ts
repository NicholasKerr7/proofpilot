import { ForbiddenException, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { RequestUser } from "../types/request-user.js";

export const portfolioDemoLimits = {
  cases: 3,
  evidenceDocuments: 12,
  packetGenerations: 3
} as const;

@Injectable()
export class PortfolioDemoPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  assertDirectUploadAllowed(user: RequestUser) {
    if (user.isPortfolioDemo) {
      throw new ForbiddenException(
        "Device uploads are disabled in the portfolio demo. Use the sample Gmail, Google Drive, or passport sources."
      );
    }
  }

  assertExternalDeliveryAllowed(user: RequestUser) {
    if (user.isPortfolioDemo) {
      throw new ForbiddenException(
        "External invitations and sharing are disabled in the portfolio demo."
      );
    }
  }

  async assertCanCreateCase(user: RequestUser) {
    if (!user.isPortfolioDemo) {
      return;
    }

    const caseCount = await this.prisma.case.count({
      where: { ownerId: user.id }
    });

    if (caseCount >= portfolioDemoLimits.cases) {
      throw new HttpException(
        `Portfolio demo workspaces are limited to ${portfolioDemoLimits.cases} cases.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  async assertCanImportEvidence(user: RequestUser, requestedDocumentCount: number) {
    if (!user.isPortfolioDemo) {
      return;
    }

    const documentCount = await this.prisma.document.count({
      where: { case: { ownerId: user.id } }
    });

    if (documentCount + requestedDocumentCount > portfolioDemoLimits.evidenceDocuments) {
      throw new HttpException(
        `Portfolio demo workspaces are limited to ${portfolioDemoLimits.evidenceDocuments} evidence files.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  async assertCanGeneratePacket(user: RequestUser) {
    if (!user.isPortfolioDemo) {
      return;
    }

    const packetCount = await this.prisma.casePacket.count({
      where: { case: { ownerId: user.id } }
    });

    if (packetCount >= portfolioDemoLimits.packetGenerations) {
      throw new HttpException(
        `Portfolio demo workspaces are limited to ${portfolioDemoLimits.packetGenerations} packet generations.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }
}
