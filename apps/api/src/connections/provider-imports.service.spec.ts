import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConnectionMode } from "@proofpilot/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentsService } from "../documents/documents.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { ProviderImportsService } from "./provider-imports.service.js";

const userId = "user-1";
const caseId = "case-1";

function createPrismaMock() {
  return {
    case: {
      findFirst: vi.fn()
    },
    connectedAccount: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  };
}

function createDocumentsServiceMock() {
  return {
    importProviderEvidence: vi.fn()
  };
}

describe("ProviderImportsService", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let documentsService: ReturnType<typeof createDocumentsServiceMock>;
  let service: ProviderImportsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    documentsService = createDocumentsServiceMock();
    service = new ProviderImportsService(
      prisma as unknown as PrismaService,
      documentsService as unknown as DocumentsService
    );
    prisma.case.findFirst.mockResolvedValue({ id: caseId });
    prisma.connectedAccount.findUnique.mockResolvedValue({
      accountLabel: "nicholas.kerr@gmail.com",
      lastSyncedAt: new Date("2026-07-22T12:00:00.000Z"),
      mode: ConnectionMode.DEMO
    });
  });

  it("returns only public Gmail metadata through an editable case", async () => {
    const catalog = await service.getCatalog(userId, caseId, "gmail");

    expect(catalog.provider).toBe("GMAIL");
    expect(catalog.connection).toEqual({
      accountLabel: "nicholas.kerr@gmail.com",
      lastSyncedAt: "2026-07-22T12:00:00.000Z",
      mode: "DEMO",
      provider: "GMAIL"
    });
    expect(catalog.items).toHaveLength(6);
    expect(catalog.items[0]).toMatchObject({
      id: "gmail-limitation-notice",
      kind: "EMAIL",
      subject: "Limitation notice from PayPal"
    });
    expect(catalog.items[0]).not.toHaveProperty("body");
    expect(prisma.case.findFirst).toHaveBeenCalledWith({
      where: {
        id: caseId,
        OR: expect.any(Array),
        archivedAt: null
      },
      select: { id: true }
    });
  });

  it("does not expose a provider catalog outside editable cases", async () => {
    prisma.case.findFirst.mockResolvedValue(null);

    await expect(service.getCatalog(userId, caseId, "GMAIL")).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prisma.connectedAccount.findUnique).not.toHaveBeenCalled();
  });

  it("requires the requested provider connection", async () => {
    prisma.connectedAccount.findUnique.mockResolvedValue(null);

    await expect(
      service.getCatalog(userId, caseId, "GOOGLE_DRIVE")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("materializes selected Gmail metadata through the secure document service", async () => {
    const document = {
      byteSize: 512,
      createdAt: "2026-07-22T12:00:00.000Z",
      id: "document-1",
      mimeType: "message/rfc822",
      originalName: "limitation-notice.eml",
      status: "PROCESSING",
      updatedAt: "2026-07-22T12:00:00.000Z"
    };
    documentsService.importProviderEvidence.mockResolvedValue({ document });

    await expect(
      service.importItems(userId, caseId, "GMAIL", {
        itemIds: ["gmail-limitation-notice"]
      })
    ).resolves.toEqual({
      documents: [document],
      importedCount: 1,
      provider: "GMAIL"
    });

    expect(documentsService.importProviderEvidence).toHaveBeenCalledWith(
      userId,
      caseId,
      expect.objectContaining({
        body: expect.any(Buffer),
        itemId: "gmail-limitation-notice",
        mimeType: "message/rfc822",
        originalName: "limitation-notice.eml",
        provider: "GMAIL"
      })
    );
    expect(prisma.connectedAccount.update).toHaveBeenCalledWith({
      where: {
        userId_provider: {
          provider: "GMAIL",
          userId
        }
      },
      data: { lastSyncedAt: expect.any(Date) }
    });
  });

  it("rejects folders, unknown items, duplicates, and unsupported providers", async () => {
    await expect(
      service.importItems(userId, caseId, "GOOGLE_DRIVE", {
        itemIds: ["drive-screenshots-folder"]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.importItems(userId, caseId, "GMAIL", {
        itemIds: ["gmail-limitation-notice", "gmail-limitation-notice"]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getCatalog(userId, caseId, "DROPBOX")).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(documentsService.importProviderEvidence).not.toHaveBeenCalled();
  });
});
