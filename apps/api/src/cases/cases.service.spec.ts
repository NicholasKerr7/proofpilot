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
      create: vi.fn().mockResolvedValue({})
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

describe("CasesService packet generation queueing", () => {
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
});
