import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";
import { NotificationsService } from "./notifications.service.js";

describe("NotificationsService", () => {
  it("lists reminders only through active cases owned by the current user", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      reminder: { findMany }
    } as unknown as PrismaService;
    const service = new NotificationsService(prisma);

    await expect(service.listReminders("owner-1")).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        case: {
          ownerId: "owner-1",
          archivedAt: null
        }
      },
      orderBy: { remindAt: "asc" },
      select: expect.objectContaining({
        case: {
          select: {
            id: true,
            platform: true,
            title: true
          }
        }
      }),
      take: 100
    });
  });
});
