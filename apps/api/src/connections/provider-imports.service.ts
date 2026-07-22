import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConnectionMode, ConnectionProvider } from "@proofpilot/database";
import {
  providerImportProviderOptions,
  type ProviderImportCatalog,
  type ProviderImportProvider,
  type ProviderImportResponse
} from "@proofpilot/types";
import { buildCaseAccessWhere } from "../common/case-access.js";
import { DocumentsService } from "../documents/documents.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { ImportProviderItemsDto } from "./dto/import-provider-items.dto.js";
import {
  getDemoProviderImportItems,
  materializeDemoProviderImport
} from "./provider-import-catalog.js";

@Injectable()
export class ProviderImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentsService: DocumentsService
  ) {}

  async getCatalog(
    userId: string,
    caseId: string,
    providerInput: string
  ): Promise<ProviderImportCatalog> {
    const provider = this.validateProvider(providerInput);
    const connection = await this.getImportContext(userId, caseId, provider);

    return {
      connection: {
        accountLabel: connection.accountLabel,
        lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
        mode: connection.mode,
        provider
      },
      items: getDemoProviderImportItems(provider),
      provider
    };
  }

  async importItems(
    userId: string,
    caseId: string,
    providerInput: string,
    input: ImportProviderItemsDto
  ): Promise<ProviderImportResponse> {
    const provider = this.validateProvider(providerInput);
    this.validateItemIds(input.itemIds);
    await this.getImportContext(userId, caseId, provider);

    const materials = await Promise.all(
      input.itemIds.map(async (itemId) => {
        const material = await materializeDemoProviderImport(provider, itemId);

        if (!material) {
          throw new BadRequestException("One or more selected provider items are unavailable.");
        }

        return { itemId, material };
      })
    );
    const documents = [];

    for (const { itemId, material } of materials) {
      const imported = await this.documentsService.importProviderEvidence(userId, caseId, {
        body: material.body,
        itemId,
        mimeType: material.mimeType,
        originalName: material.originalName,
        provider
      });
      documents.push(imported.document);
    }

    await this.prisma.connectedAccount.update({
      where: {
        userId_provider: {
          provider: provider as ConnectionProvider,
          userId
        }
      },
      data: { lastSyncedAt: new Date() }
    });

    return {
      documents,
      importedCount: documents.length,
      provider
    };
  }

  private async getImportContext(
    userId: string,
    caseId: string,
    provider: ProviderImportProvider
  ) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ...buildCaseAccessWhere(userId, "EDIT"),
        archivedAt: null
      },
      select: { id: true }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    const connection = await this.prisma.connectedAccount.findUnique({
      where: {
        userId_provider: {
          provider: provider as ConnectionProvider,
          userId
        }
      },
      select: {
        accountLabel: true,
        lastSyncedAt: true,
        mode: true
      }
    });

    if (!connection?.accountLabel) {
      throw new NotFoundException(`${formatProviderLabel(provider)} is not connected.`);
    }

    if (connection.mode !== ConnectionMode.DEMO) {
      throw new ServiceUnavailableException(
        `${formatProviderLabel(provider)} OAuth import is not configured yet.`
      );
    }

    return {
      accountLabel: connection.accountLabel,
      lastSyncedAt: connection.lastSyncedAt,
      mode: connection.mode
    };
  }

  private validateProvider(provider: string): ProviderImportProvider {
    const normalizedProvider = provider.toUpperCase();

    if (!providerImportProviderOptions.includes(normalizedProvider as ProviderImportProvider)) {
      throw new BadRequestException("Provider import is not supported.");
    }

    return normalizedProvider as ProviderImportProvider;
  }

  private validateItemIds(itemIds: string[]) {
    if (
      !Array.isArray(itemIds) ||
      itemIds.length < 1 ||
      itemIds.length > 10 ||
      new Set(itemIds).size !== itemIds.length ||
      itemIds.some(
        (itemId) =>
          typeof itemId !== "string" ||
          itemId.length > 80 ||
          !/^[a-z0-9-]+$/.test(itemId)
      )
    ) {
      throw new BadRequestException("Select between 1 and 10 valid provider items.");
    }
  }
}

function formatProviderLabel(provider: ProviderImportProvider) {
  return provider === "GMAIL" ? "Gmail" : "Google Drive";
}
