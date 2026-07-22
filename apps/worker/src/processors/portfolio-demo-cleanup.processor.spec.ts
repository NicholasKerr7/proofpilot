import type { PrismaClient } from "@proofpilot/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expirePortfolioDemoWorkspaceBatch } from "./portfolio-demo-cleanup.processor.js";

const now = new Date("2026-07-22T18:00:00.000Z");
const expiresAt = new Date("2026-07-22T17:59:00.000Z");

function createPrismaMock() {
  return {
    user: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([
        {
          cases: [
            {
              documents: [
                {
                  storageKey: "users/demo/cases/case-1/evidence.pdf",
                  versions: [
                    { storageKey: "users/demo/cases/case-1/evidence.pdf" },
                    { storageKey: "users/demo/cases/case-1/evidence-v2.pdf" }
                  ]
                }
              ],
              packets: [
                {
                  exports: [
                    { storageKey: "users/demo/cases/case-1/packet.pdf" }
                  ]
                }
              ]
            }
          ],
          id: "demo-user-1",
          portfolioDemoExpiresAt: expiresAt
        }
      ])
    }
  };
}

function createDeleteObjectMock() {
  return vi.fn(async (_input: { key: string }) => undefined);
}

describe("expirePortfolioDemoWorkspaceBatch", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let deleteObject: ReturnType<typeof createDeleteObjectMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    deleteObject = createDeleteObjectMock();
  });

  it("removes unique storage objects before deleting an expired workspace", async () => {
    await expect(
      expirePortfolioDemoWorkspaceBatch(
        prisma as unknown as PrismaClient,
        now,
        deleteObject
      )
    ).resolves.toEqual({
      contended: 0,
      deleted: 1,
      examined: 1,
      failed: 0,
      storageObjectsDeleted: 3
    });

    expect(deleteObject).toHaveBeenCalledTimes(3);
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "demo-user-1",
        isPortfolioDemo: true,
        portfolioDemoExpiresAt: expiresAt
      }
    });
  });

  it("retains the workspace when storage cleanup fails so it can retry", async () => {
    deleteObject.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(
      expirePortfolioDemoWorkspaceBatch(
        prisma as unknown as PrismaClient,
        now,
        deleteObject
      )
    ).resolves.toMatchObject({ deleted: 0, failed: 1 });

    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });
});
