import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentProcessingQueueService } from "./document-processing-queue.service.js";
import type { PacketGenerationQueueService } from "./packet-generation-queue.service.js";
import { QueueHealthService } from "./queue-health.service.js";

type DocumentQueueMock = ReturnType<typeof createQueueMock>;
type PacketQueueMock = ReturnType<typeof createQueueMock>;

function createQueueMock() {
  return {
    getHealthSnapshot: vi.fn()
  };
}

function createService(documentQueue: DocumentQueueMock, packetQueue: PacketQueueMock) {
  return new QueueHealthService(
    documentQueue as unknown as DocumentProcessingQueueService,
    packetQueue as unknown as PacketGenerationQueueService
  );
}

function okSnapshot(name: string, failed = 0) {
  return {
    counts: {
      active: 0,
      completed: 2,
      delayed: 0,
      failed,
      paused: 0,
      prioritized: 0,
      waiting: 1,
      "waiting-children": 0
    },
    name,
    paused: false,
    status: "ok" as const
  };
}

describe("QueueHealthService", () => {
  let documentQueue: DocumentQueueMock;
  let packetQueue: PacketQueueMock;
  let service: QueueHealthService;

  beforeEach(() => {
    documentQueue = createQueueMock();
    packetQueue = createQueueMock();
    service = createService(documentQueue, packetQueue);
  });

  it("returns ok when both queues respond with ok snapshots", async () => {
    documentQueue.getHealthSnapshot.mockResolvedValue(okSnapshot("document-processing"));
    packetQueue.getHealthSnapshot.mockResolvedValue(okSnapshot("packet-generation"));

    const result = await service.getHealth();

    expect(result.status).toBe("ok");
    expect(result.queues).toEqual([
      okSnapshot("document-processing"),
      okSnapshot("packet-generation")
    ]);
    expect(Date.parse(result.timestamp)).not.toBeNaN();
  });

  it("returns degraded when a queue snapshot throws", async () => {
    documentQueue.getHealthSnapshot.mockResolvedValue(okSnapshot("document-processing"));
    packetQueue.getHealthSnapshot.mockRejectedValue(new Error("Redis is unavailable"));

    const result = await service.getHealth();

    expect(result.status).toBe("degraded");
    expect(result.queues).toEqual([
      okSnapshot("document-processing"),
      {
        error: "Redis is unavailable",
        name: "packet-generation",
        status: "degraded"
      }
    ]);
  });
});
