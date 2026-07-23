import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentProcessingQueueService } from "./document-processing-queue.service.js";
import type { NotificationEmailQueueService } from "./notification-email-queue.service.js";
import type { PacketGenerationQueueService } from "./packet-generation-queue.service.js";
import type { PacketShareEmailQueueService } from "./packet-share-email-queue.service.js";
import { QueueHealthService } from "./queue-health.service.js";
import type { ReminderDeliveryQueueService } from "./reminder-delivery-queue.service.js";
import type { UploadCleanupQueueService } from "./upload-cleanup-queue.service.js";

type DocumentQueueMock = ReturnType<typeof createQueueMock>;
type NotificationEmailQueueMock = ReturnType<typeof createQueueMock>;
type PacketQueueMock = ReturnType<typeof createQueueMock>;
type PacketShareEmailQueueMock = ReturnType<typeof createQueueMock>;
type ReminderQueueMock = ReturnType<typeof createQueueMock>;
type UploadCleanupQueueMock = ReturnType<typeof createQueueMock>;

function createQueueMock() {
  return {
    getHealthSnapshot: vi.fn()
  };
}

function createService(
  documentQueue: DocumentQueueMock,
  notificationEmailQueue: NotificationEmailQueueMock,
  packetQueue: PacketQueueMock,
  packetShareEmailQueue: PacketShareEmailQueueMock,
  reminderQueue: ReminderQueueMock,
  uploadCleanupQueue: UploadCleanupQueueMock
) {
  return new QueueHealthService(
    documentQueue as unknown as DocumentProcessingQueueService,
    notificationEmailQueue as unknown as NotificationEmailQueueService,
    packetQueue as unknown as PacketGenerationQueueService,
    packetShareEmailQueue as unknown as PacketShareEmailQueueService,
    reminderQueue as unknown as ReminderDeliveryQueueService,
    uploadCleanupQueue as unknown as UploadCleanupQueueService
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
  let notificationEmailQueue: NotificationEmailQueueMock;
  let packetQueue: PacketQueueMock;
  let packetShareEmailQueue: PacketShareEmailQueueMock;
  let reminderQueue: ReminderQueueMock;
  let uploadCleanupQueue: UploadCleanupQueueMock;
  let service: QueueHealthService;

  beforeEach(() => {
    documentQueue = createQueueMock();
    notificationEmailQueue = createQueueMock();
    packetQueue = createQueueMock();
    packetShareEmailQueue = createQueueMock();
    reminderQueue = createQueueMock();
    uploadCleanupQueue = createQueueMock();
    service = createService(
      documentQueue,
      notificationEmailQueue,
      packetQueue,
      packetShareEmailQueue,
      reminderQueue,
      uploadCleanupQueue
    );
  });

  it("returns ok when every queue responds with an ok snapshot", async () => {
    documentQueue.getHealthSnapshot.mockResolvedValue(okSnapshot("document-processing"));
    notificationEmailQueue.getHealthSnapshot.mockResolvedValue(okSnapshot("notification-email"));
    packetQueue.getHealthSnapshot.mockResolvedValue(okSnapshot("packet-generation"));
    packetShareEmailQueue.getHealthSnapshot.mockResolvedValue(okSnapshot("packet-share-email"));
    reminderQueue.getHealthSnapshot.mockResolvedValue(okSnapshot("reminder-delivery"));
    uploadCleanupQueue.getHealthSnapshot.mockResolvedValue(okSnapshot("upload-cleanup"));

    const result = await service.getHealth();

    expect(result.status).toBe("ok");
    expect(result.queues).toEqual([
      okSnapshot("document-processing"),
      okSnapshot("notification-email"),
      okSnapshot("packet-generation"),
      okSnapshot("packet-share-email"),
      okSnapshot("reminder-delivery"),
      okSnapshot("upload-cleanup")
    ]);
    expect(Date.parse(result.timestamp)).not.toBeNaN();
  });

  it("returns degraded when a queue snapshot throws", async () => {
    documentQueue.getHealthSnapshot.mockResolvedValue(okSnapshot("document-processing"));
    notificationEmailQueue.getHealthSnapshot.mockResolvedValue(okSnapshot("notification-email"));
    packetQueue.getHealthSnapshot.mockRejectedValue(new Error("Redis is unavailable"));
    packetShareEmailQueue.getHealthSnapshot.mockResolvedValue(okSnapshot("packet-share-email"));
    reminderQueue.getHealthSnapshot.mockResolvedValue(okSnapshot("reminder-delivery"));
    uploadCleanupQueue.getHealthSnapshot.mockResolvedValue(okSnapshot("upload-cleanup"));

    const result = await service.getHealth();

    expect(result.status).toBe("degraded");
    expect(result.queues).toEqual([
      okSnapshot("document-processing"),
      okSnapshot("notification-email"),
      {
        error: "Redis is unavailable",
        name: "packet-generation",
        status: "degraded"
      },
      okSnapshot("packet-share-email"),
      okSnapshot("reminder-delivery"),
      okSnapshot("upload-cleanup")
    ]);
  });
});
