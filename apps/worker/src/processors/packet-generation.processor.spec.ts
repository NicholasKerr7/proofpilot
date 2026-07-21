import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratePacketJobData } from "../queues/packet-generation.queue.js";

type PrismaMock = ReturnType<typeof createPrismaMock>;

const mocks = vi.hoisted(() => ({
  generateCasePacketPdf: vi.fn(),
  prisma: undefined as unknown,
  readStoredObjectChunks: vi.fn(),
  writeStoredObjectBytes: vi.fn()
}));

vi.mock("@proofpilot/database", () => ({
  CaseStatus: {
    PACKET_GENERATED: "PACKET_GENERATED"
  },
  DocumentStatus: {
    FAILED: "FAILED",
    NEEDS_REVIEW: "NEEDS_REVIEW",
    PROCESSED: "PROCESSED",
    PROCESSING: "PROCESSING",
    UPLOADED: "UPLOADED"
  },
  PacketStatus: {
    FAILED: "FAILED",
    GENERATING: "GENERATING",
    READY: "READY"
  },
  getPrismaClient: () => mocks.prisma
}));

vi.mock("@proofpilot/storage", () => ({
  readStoredObjectChunks: mocks.readStoredObjectChunks,
  writeStoredObjectBytes: mocks.writeStoredObjectBytes
}));

vi.mock("./case-packet-pdf.js", () => ({
  generateCasePacketPdf: mocks.generateCasePacketPdf
}));

const ownerId = "user-1";
const caseId = "case-1";
const packetId = "packet-1";

function createPrismaMock() {
  return {
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    auditLog: {
      create: vi.fn().mockResolvedValue({})
    },
    case: {
      update: vi.fn().mockResolvedValue({})
    },
    casePacket: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({})
    },
    notification: {
      create: vi.fn().mockResolvedValue({})
    },
    packetExport: {
      create: vi.fn().mockResolvedValue({})
    }
  };
}

function createPacketRecord(overrides: Partial<ReturnType<typeof basePacketRecord>> = {}) {
  return {
    ...basePacketRecord(),
    ...overrides
  };
}

function basePacketRecord() {
  const timestamp = new Date("2026-01-01T12:00:00.000Z");

  return {
    id: packetId,
    status: "GENERATING",
    exports: [] as { id: string }[],
    case: {
      id: caseId,
      ownerId,
      title: "PayPal limitation appeal",
      platform: "PayPal",
      summary: "Account was limited after a review.",
      deadline: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      owner: {
        email: "nicholas.kerr@proofpilot.test",
        name: "Nicholas Kerr",
        preference: {
          inAppNotifications: true,
          notifyPacketReady: true
        }
      },
      caseType: {
        name: "Account Ban / Appeal Builder"
      },
      checklist: [],
      documents: [] as Array<{
        originalName: string;
        mimeType: string;
        byteSize: number;
        status: string;
        createdAt: Date;
        extractedText: string | null;
        quarantinedAt: Date | null;
        storageKey: string;
      }>,
      events: [],
      statements: []
    }
  };
}

function createJob(attemptsMade = 0): Job<GeneratePacketJobData> {
  return {
    attemptsMade,
    data: {
      caseId,
      ownerId,
      packetId
    },
    name: "generate_case_packet",
    opts: {
      attempts: 3
    }
  } as Job<GeneratePacketJobData>;
}

async function loadGenerateCasePacket(prisma: PrismaMock) {
  mocks.prisma = prisma;
  vi.resetModules();
  const module = await import("./packet-generation.processor.js");
  return module.generateCasePacket;
}

describe("packet generation worker processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates, stores, and marks a packet ready", async () => {
    const prisma = createPrismaMock();
    const packet = createPacketRecord();
    const pdfBytes = Buffer.from("proofpilot-pdf");
    const pdf = {
      bytes: pdfBytes,
      includedDocumentCount: 2,
      indexedDocumentCount: 3,
      pageCount: 9
    };
    prisma.casePacket.findFirst.mockResolvedValue(packet);
    mocks.generateCasePacketPdf.mockResolvedValue(pdf);
    mocks.writeStoredObjectBytes.mockResolvedValue(undefined);

    const generateCasePacket = await loadGenerateCasePacket(prisma);
    const result = await generateCasePacket(createJob());

    expect(prisma.casePacket.findFirst).toHaveBeenCalledWith({
      where: {
        id: packetId,
        caseId,
        case: {
          archivedAt: null,
          ownerId
        }
      },
      select: expect.any(Object)
    });
    expect(prisma.casePacket.update).toHaveBeenNthCalledWith(1, {
      where: { id: packetId },
      data: { status: "GENERATING" }
    });
    expect(mocks.generateCasePacketPdf).toHaveBeenCalledWith(packet.case);
    expect(mocks.writeStoredObjectBytes).toHaveBeenCalledWith({
      body: pdfBytes,
      contentType: "application/pdf",
      key: expect.stringMatching(new RegExp(`^users/${ownerId}/cases/${caseId}/packets/.+\\.pdf$`))
    });
    expect(prisma.packetExport.create).toHaveBeenCalledWith({
      data: {
        byteSize: pdfBytes.byteLength,
        includedDocumentCount: 2,
        indexedDocumentCount: 3,
        packetId,
        pageCount: 9,
        storageKey: expect.stringMatching(new RegExp(`^users/${ownerId}/cases/${caseId}/packets/.+\\.pdf$`))
      }
    });
    expect(prisma.casePacket.update).toHaveBeenNthCalledWith(2, {
      where: { id: packetId },
      data: { status: "READY" }
    });
    expect(prisma.case.update).toHaveBeenCalledWith({
      where: { id: caseId },
      data: { status: "PACKET_GENERATED" }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "case.packet_generated",
        metadata: {
          byteSize: pdfBytes.byteLength,
          includedDocumentCount: 2,
          indexedDocumentCount: 3,
          pageCount: 9,
          packetId
        }
      }
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        type: "packet_ready",
        title: "Packet ready",
        body: "PayPal packet for PayPal limitation appeal is ready to download."
      }
    });
    expect(result).toEqual({
      packetId,
      status: "READY"
    });
  });

  it("loads only bounded, processed visual evidence before rendering", async () => {
    const prisma = createPrismaMock();
    const timestamp = new Date("2026-01-01T12:00:00.000Z");
    const packet = createPacketRecord();
    packet.case.documents = [
      {
        originalName: "notice.pdf",
        mimeType: "application/pdf",
        byteSize: 24,
        status: "PROCESSED",
        createdAt: timestamp,
        extractedText: "Account limitation notice",
        quarantinedAt: null,
        storageKey: "users/user-1/cases/case-1/notice.pdf"
      },
      {
        originalName: "quarantined.png",
        mimeType: "image/png",
        byteSize: 24,
        status: "PROCESSED",
        createdAt: timestamp,
        extractedText: "Unsafe content",
        quarantinedAt: timestamp,
        storageKey: "users/user-1/cases/case-1/quarantined.png"
      },
      {
        originalName: "support.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        byteSize: 48,
        status: "NEEDS_REVIEW",
        createdAt: timestamp,
        extractedText: "Support confirmed receipt.",
        quarantinedAt: null,
        storageKey: "users/user-1/cases/case-1/support.docx"
      }
    ];
    const sourceBytes = Buffer.from("source-pdf");
    prisma.casePacket.findFirst.mockResolvedValue(packet);
    mocks.readStoredObjectChunks.mockResolvedValue({
      chunks: createByteStream(sourceBytes),
      etag: null
    });
    mocks.generateCasePacketPdf.mockResolvedValue({
      bytes: Buffer.from("packet-pdf"),
      includedDocumentCount: 2,
      indexedDocumentCount: 3,
      pageCount: 7
    });

    const generateCasePacket = await loadGenerateCasePacket(prisma);
    await generateCasePacket(createJob());

    expect(mocks.readStoredObjectChunks).toHaveBeenCalledTimes(1);
    expect(mocks.readStoredObjectChunks).toHaveBeenCalledWith({
      key: "users/user-1/cases/case-1/notice.pdf"
    });
    expect(mocks.generateCasePacketPdf).toHaveBeenCalledWith({
      ...packet.case,
      documents: [
        expect.objectContaining({
          originalName: "notice.pdf",
          extractedText: "Account limitation notice",
          supportingContent: {
            bytes: new Uint8Array(sourceBytes),
            kind: "pdf"
          }
        }),
        expect.objectContaining({
          originalName: "quarantined.png",
          extractedText: null,
          supportingContent: null,
          supportingNote: expect.stringContaining("quarantined")
        }),
        expect.objectContaining({
          originalName: "support.docx",
          extractedText: "Support confirmed receipt.",
          supportingContent: null,
          supportingNote: expect.stringContaining("extracted text")
        })
      ]
    });
  });

  it("does not create a packet alert when packet notifications are disabled", async () => {
    const prisma = createPrismaMock();
    const packet = createPacketRecord();
    packet.case.owner.preference.notifyPacketReady = false;
    prisma.casePacket.findFirst.mockResolvedValue(packet);
    mocks.generateCasePacketPdf.mockResolvedValue({
      bytes: Buffer.from("proofpilot-pdf"),
      includedDocumentCount: 0,
      indexedDocumentCount: 0,
      pageCount: 6
    });
    mocks.writeStoredObjectBytes.mockResolvedValue(undefined);

    const generateCasePacket = await loadGenerateCasePacket(prisma);

    await expect(generateCasePacket(createJob())).resolves.toEqual({
      packetId,
      status: "READY"
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "case.packet_generated" })
      })
    );
  });

  it("stops a stored evidence stream when its recorded size is stale", async () => {
    const prisma = createPrismaMock();
    const packet = createPacketRecord();
    packet.case.documents = [
      {
        originalName: "oversized.pdf",
        mimeType: "application/pdf",
        byteSize: 24,
        status: "PROCESSED",
        createdAt: new Date("2026-01-01T12:00:00.000Z"),
        extractedText: "Fallback text",
        quarantinedAt: null,
        storageKey: "users/user-1/cases/case-1/oversized.pdf"
      }
    ];
    prisma.casePacket.findFirst.mockResolvedValue(packet);
    mocks.readStoredObjectChunks.mockResolvedValue({
      chunks: createDeclaredSizeStream(12 * 1024 * 1024 + 1),
      etag: null
    });
    mocks.generateCasePacketPdf.mockResolvedValue({
      bytes: Buffer.from("packet-pdf"),
      includedDocumentCount: 1,
      indexedDocumentCount: 1,
      pageCount: 4
    });

    const generateCasePacket = await loadGenerateCasePacket(prisma);
    await generateCasePacket(createJob());

    expect(mocks.generateCasePacketPdf).toHaveBeenCalledWith({
      ...packet.case,
      documents: [
        expect.objectContaining({
          extractedText: "Fallback text",
          originalName: "oversized.pdf",
          supportingContent: null,
          supportingNote: expect.stringContaining("evidence limit")
        })
      ]
    });
  });

  it("skips rendering when the packet is already ready with an export", async () => {
    const prisma = createPrismaMock();
    prisma.casePacket.findFirst.mockResolvedValue(
      createPacketRecord({
        status: "READY",
        exports: [{ id: "export-1" }]
      })
    );

    const generateCasePacket = await loadGenerateCasePacket(prisma);
    const result = await generateCasePacket(createJob());

    expect(mocks.generateCasePacketPdf).not.toHaveBeenCalled();
    expect(mocks.writeStoredObjectBytes).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(result).toEqual({
      packetId,
      status: "READY"
    });
  });

  it("marks the packet failed on the final failed attempt", async () => {
    const prisma = createPrismaMock();
    prisma.casePacket.findFirst.mockResolvedValue(createPacketRecord());
    mocks.generateCasePacketPdf.mockRejectedValue(new Error("PDF renderer failed"));

    const generateCasePacket = await loadGenerateCasePacket(prisma);

    await expect(generateCasePacket(createJob(2))).rejects.toThrow("PDF renderer failed");

    expect(prisma.casePacket.update).toHaveBeenNthCalledWith(2, {
      where: { id: packetId },
      data: { status: "FAILED" }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "case.packet_generation_failed",
        metadata: {
          message: "PDF renderer failed",
          packetId
        }
      }
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        type: "packet_failed",
        title: "Packet generation failed",
        body: "PayPal packet for PayPal limitation appeal could not be generated. PDF renderer failed"
      }
    });
  });
});

async function* createByteStream(bytes: Buffer) {
  yield bytes;
}

async function* createDeclaredSizeStream(byteLength: number) {
  yield { byteLength } as Uint8Array;
}
