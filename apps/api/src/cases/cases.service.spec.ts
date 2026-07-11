import { NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PacketStatus } from "@proofpilot/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { PacketGenerationQueueService } from "../queue/packet-generation-queue.service.js";
import { CasesService } from "./cases.service.js";

type PrismaMock = ReturnType<typeof createPrismaMock>;
type QueueMock = ReturnType<typeof createPacketQueueMock>;

const ownerId = "user-1";
const caseId = "case-1";
const packetCreatedAt = new Date("2026-01-01T12:00:00.000Z");
const packetUpdatedAt = new Date("2026-01-01T12:01:00.000Z");

function createPacketRecord(overrides: Partial<ReturnType<typeof basePacketRecord>> = {}) {
  return {
    ...basePacketRecord(),
    ...overrides
  };
}

function basePacketRecord() {
  return {
    id: "packet-1",
    caseId,
    status: PacketStatus.GENERATING,
    createdAt: packetCreatedAt,
    updatedAt: packetUpdatedAt,
    exports: []
  };
}

function createPrismaMock() {
  return {
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    auditLog: {
      count: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn()
    },
    case: {
      findFirst: vi.fn()
    },
    casePacket: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({})
    }
  };
}

function createPacketQueueMock() {
  return {
    addGeneratePacketJob: vi.fn()
  };
}

function createService(prisma: PrismaMock, queue: QueueMock) {
  return new CasesService(
    prisma as unknown as PrismaService,
    queue as unknown as PacketGenerationQueueService
  );
}

describe("CasesService", () => {
  let prisma: PrismaMock;
  let queue: QueueMock;
  let service: CasesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    queue = createPacketQueueMock();
    service = createService(prisma, queue);
  });

  it("creates a generating packet and enqueues packet generation", async () => {
    const packet = createPacketRecord();
    prisma.case.findFirst.mockResolvedValue({ id: caseId });
    prisma.casePacket.findFirst.mockResolvedValue(null);
    prisma.casePacket.create.mockResolvedValue(packet);
    queue.addGeneratePacketJob.mockResolvedValue({ id: "job-1", name: "generate_case_packet" });

    const result = await service.generatePacket(ownerId, caseId);

    expect(prisma.case.findFirst).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        id: caseId,
        ownerId
      },
      select: { id: true }
    });
    expect(prisma.casePacket.create).toHaveBeenCalledWith({
      data: {
        caseId,
        status: PacketStatus.GENERATING
      },
      select: expect.any(Object)
    });
    expect(queue.addGeneratePacketJob).toHaveBeenCalledWith({
      caseId,
      ownerId,
      packetId: packet.id
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "case.packet_generation_queued",
        metadata: {
          jobId: "job-1",
          packetId: packet.id
        }
      }
    });
    expect(result).toEqual({
      id: packet.id,
      caseId,
      status: PacketStatus.GENERATING,
      createdAt: packetCreatedAt,
      updatedAt: packetUpdatedAt,
      exports: []
    });
  });

  it("returns an existing generating packet without enqueueing a duplicate job", async () => {
    const existingPacket = createPacketRecord({ id: "packet-existing" });
    prisma.case.findFirst.mockResolvedValue({ id: caseId });
    prisma.casePacket.findFirst.mockResolvedValue(existingPacket);

    const result = await service.generatePacket(ownerId, caseId);

    expect(prisma.casePacket.create).not.toHaveBeenCalled();
    expect(queue.addGeneratePacketJob).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(result.id).toBe(existingPacket.id);
    expect(result.status).toBe(PacketStatus.GENERATING);
  });

  it("rejects packet generation when the case is not owned by the user", async () => {
    prisma.case.findFirst.mockResolvedValue(null);

    await expect(service.generatePacket(ownerId, caseId)).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.casePacket.findFirst).not.toHaveBeenCalled();
    expect(queue.addGeneratePacketJob).not.toHaveBeenCalled();
  });

  it("marks the packet failed when enqueueing the job fails", async () => {
    const packet = createPacketRecord();
    prisma.case.findFirst.mockResolvedValue({ id: caseId });
    prisma.casePacket.findFirst.mockResolvedValue(null);
    prisma.casePacket.create.mockResolvedValue(packet);
    queue.addGeneratePacketJob.mockRejectedValue(new Error("Redis is unavailable"));

    await expect(service.generatePacket(ownerId, caseId)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );

    expect(prisma.casePacket.update).toHaveBeenCalledWith({
      where: { id: packet.id },
      data: { status: PacketStatus.FAILED }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: ownerId,
        caseId,
        action: "case.packet_generation_queue_failed",
        metadata: {
          message: "Redis is unavailable",
          packetId: packet.id
        }
      }
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns paginated, sanitized case activity for the owner", async () => {
    const firstCreatedAt = new Date("2026-05-13T14:30:00.000Z");
    const secondCreatedAt = new Date("2026-05-13T14:20:00.000Z");
    prisma.case.findFirst.mockResolvedValue({ id: caseId });
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: "activity-1",
        action: "document.upload_completed",
        metadata: {
          documentId: "document-1",
          originalName: "account-notice.pdf",
          jobId: "private-job-id"
        },
        createdAt: firstCreatedAt
      },
      {
        id: "activity-2",
        action: "document.processing_failed",
        metadata: {
          documentId: "document-2",
          originalName: "support-thread.png",
          message: "Internal provider details"
        },
        createdAt: secondCreatedAt
      }
    ]);
    prisma.auditLog.count.mockResolvedValue(3);

    const result = await service.listActivity(ownerId, caseId, {
      category: "evidence",
      limit: 2,
      offset: 0
    });

    const where = {
      caseId,
      action: { startsWith: "document." }
    };
    expect(prisma.case.findFirst).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        id: caseId,
        ownerId
      },
      select: { id: true }
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: 0,
      take: 2,
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true
      }
    });
    expect(prisma.auditLog.count).toHaveBeenCalledWith({ where });
    expect(result).toEqual({
      items: [
        {
          id: "activity-1",
          action: "document.upload_completed",
          category: "evidence",
          title: "Document uploaded",
          detail: "account-notice.pdf",
          createdAt: firstCreatedAt.toISOString()
        },
        {
          id: "activity-2",
          action: "document.processing_failed",
          category: "evidence",
          title: "Document processing failed",
          detail: "support-thread.png",
          createdAt: secondCreatedAt.toISOString()
        }
      ],
      total: 3,
      hasMore: true
    });
  });

  it("rejects activity access when the case is not owned by the user", async () => {
    prisma.case.findFirst.mockResolvedValue(null);

    await expect(
      service.listActivity(ownerId, caseId, {
        category: "all",
        limit: 20,
        offset: 0
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.count).not.toHaveBeenCalled();
  });
});
