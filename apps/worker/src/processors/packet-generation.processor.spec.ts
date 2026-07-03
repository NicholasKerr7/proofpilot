import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratePacketJobData } from "../queues/packet-generation.queue.js";

type PrismaMock = ReturnType<typeof createPrismaMock>;

const mocks = vi.hoisted(() => ({
  generateCasePacketPdf: vi.fn(),
  prisma: undefined as unknown,
  writeStoredObjectBytes: vi.fn()
}));

vi.mock("@proofpilot/database", () => ({
  CaseStatus: {
    PACKET_GENERATED: "PACKET_GENERATED"
  },
  PacketStatus: {
    FAILED: "FAILED",
    GENERATING: "GENERATING",
    READY: "READY"
  },
  getPrismaClient: () => mocks.prisma
}));

vi.mock("@proofpilot/storage", () => ({
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
        name: "Nicholas Kerr"
      },
      caseType: {
        name: "Account Ban / Appeal Builder"
      },
      checklist: [],
      documents: [],
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
    prisma.casePacket.findFirst.mockResolvedValue(packet);
    mocks.generateCasePacketPdf.mockResolvedValue(pdfBytes);
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
        packetId,
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
