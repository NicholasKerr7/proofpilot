import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateReminderDto } from "./dto/create-reminder.dto.js";
import type { UpdateReminderDto } from "./dto/update-reminder.dto.js";

const maxDueRemindersPerRequest = 25;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ownerId: string) {
    await this.materializeDueReminders(ownerId);

    return this.prisma.notification.findMany({
      where: { userId: ownerId },
      orderBy: { createdAt: "desc" },
      select: this.getNotificationSelect(),
      take: 50
    });
  }

  async markRead(ownerId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: ownerId
      },
      select: {
        id: true,
        readAt: true
      }
    });

    if (!notification) {
      throw new NotFoundException("Notification not found.");
    }

    return this.prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: notification.readAt ?? new Date() },
      select: this.getNotificationSelect()
    });
  }

  async listReminders(ownerId: string) {
    return this.prisma.reminder.findMany({
      where: {
        case: {
          ownerId,
          archivedAt: null
        }
      },
      orderBy: { remindAt: "asc" },
      select: {
        ...this.getReminderSelect(),
        case: {
          select: {
            id: true,
            platform: true,
            title: true
          }
        }
      },
      take: 100
    });
  }

  async listCaseReminders(ownerId: string, caseId: string) {
    await this.assertCaseOwnership(ownerId, caseId);

    return this.prisma.reminder.findMany({
      where: { caseId },
      orderBy: { remindAt: "asc" },
      select: this.getReminderSelect()
    });
  }

  async createCaseReminder(ownerId: string, caseId: string, input: CreateReminderDto) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ownerId,
        archivedAt: null
      },
      select: {
        id: true,
        deadline: true,
        platform: true,
        title: true
      }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    const remindAt = this.parseFutureReminderDate(input.remindAt);
    const suppliedMessage = input.message?.trim();

    if (input.message !== undefined && (!suppliedMessage || suppliedMessage.length > 500)) {
      throw new BadRequestException("Reminder message must be 1 to 500 characters.");
    }

    const message = suppliedMessage ?? this.getDefaultReminderMessage(foundCase);

    return this.prisma.$transaction(async (tx) => {
      const reminder = await tx.reminder.create({
        data: {
          caseId: foundCase.id,
          message,
          remindAt
        },
        select: this.getReminderSelect()
      });

      await tx.auditLog.create({
        data: {
          userId: ownerId,
          caseId: foundCase.id,
          action: "case.reminder_created",
          metadata: {
            remindAt: reminder.remindAt.toISOString(),
            reminderId: reminder.id
          }
        }
      });

      return reminder;
    });
  }

  async updateReminder(ownerId: string, reminderId: string, input: UpdateReminderDto) {
    const hasChanges =
      input.remindAt !== undefined || input.message !== undefined || input.completed !== undefined;

    if (!hasChanges) {
      throw new BadRequestException("Provide a reminder change.");
    }

    const remindAt =
      input.remindAt !== undefined ? this.parseFutureReminderDate(input.remindAt) : null;
    const message = input.message?.trim();

    if (input.message !== undefined && (!message || message.length > 500)) {
      throw new BadRequestException("Reminder message must be 1 to 500 characters.");
    }

    const reminder = await this.prisma.reminder.findFirst({
      where: {
        id: reminderId,
        case: {
          ownerId,
          archivedAt: null
        }
      },
      select: {
        id: true,
        caseId: true
      }
    });

    if (!reminder) {
      throw new NotFoundException("Reminder not found.");
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedReminder = await tx.reminder.update({
        where: { id: reminder.id },
        data: {
          ...(remindAt
            ? {
                remindAt,
                sentAt: null,
                completedAt: null
              }
            : {}),
          ...(message ? { message } : {}),
          ...(input.completed !== undefined
            ? { completedAt: input.completed ? new Date() : null }
            : {})
        },
        select: this.getReminderSelect()
      });

      await tx.auditLog.create({
        data: {
          userId: ownerId,
          caseId: reminder.caseId,
          action: "case.reminder_updated",
          metadata: {
            reminderId: reminder.id,
            ...(remindAt ? { remindAt: remindAt.toISOString() } : {}),
            ...(input.message !== undefined ? { messageUpdated: true } : {}),
            ...(input.completed !== undefined ? { completed: input.completed } : {})
          }
        }
      });

      return updatedReminder;
    });
  }

  async deleteReminder(ownerId: string, reminderId: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: {
        id: reminderId,
        case: {
          ownerId,
          archivedAt: null
        }
      },
      select: {
        id: true,
        caseId: true,
        message: true
      }
    });

    if (!reminder) {
      throw new NotFoundException("Reminder not found.");
    }

    await this.prisma.$transaction([
      this.prisma.reminder.delete({
        where: { id: reminder.id }
      }),
      this.prisma.auditLog.create({
        data: {
          userId: ownerId,
          caseId: reminder.caseId,
          action: "case.reminder_deleted",
          metadata: {
            message: reminder.message,
            reminderId: reminder.id
          }
        }
      })
    ]);

    return { id: reminder.id, deleted: true };
  }

  private async assertCaseOwnership(ownerId: string, caseId: string) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ownerId,
        archivedAt: null
      },
      select: { id: true }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }
  }

  private async materializeDueReminders(ownerId: string) {
    const dueReminders = await this.prisma.reminder.findMany({
      where: {
        sentAt: null,
        completedAt: null,
        remindAt: {
          lte: new Date()
        },
        case: {
          ownerId,
          archivedAt: null
        }
      },
      orderBy: { remindAt: "asc" },
      select: {
        id: true,
        message: true,
        remindAt: true,
        case: {
          select: {
            id: true,
            platform: true,
            title: true
          }
        }
      },
      take: maxDueRemindersPerRequest
    });

    for (const reminder of dueReminders) {
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.reminder.updateMany({
          where: {
            id: reminder.id,
            sentAt: null,
            completedAt: null
          },
          data: { sentAt: new Date() }
        });

        if (!updated.count) {
          return;
        }

        await tx.notification.create({
          data: {
            userId: ownerId,
            caseId: reminder.case.id,
            type: "deadline_reminder",
            title: `Reminder: ${reminder.case.title}`,
            body: reminder.message
          }
        });

        await tx.auditLog.create({
          data: {
            userId: ownerId,
            caseId: reminder.case.id,
            action: "case.reminder_sent",
            metadata: {
              reminderId: reminder.id,
              remindAt: reminder.remindAt.toISOString()
            }
          }
        });
      });
    }
  }

  private getDefaultReminderMessage(foundCase: {
    deadline: Date | null;
    platform: string;
    title: string;
  }) {
    const deadlineText = foundCase.deadline
      ? ` before the ${foundCase.platform} deadline on ${foundCase.deadline.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        })}`
      : "";

    return `Review evidence and packet readiness for ${foundCase.title}${deadlineText}.`;
  }

  private getNotificationSelect() {
    return {
      id: true,
      caseId: true,
      type: true,
      title: true,
      body: true,
      readAt: true,
      createdAt: true,
      case: {
        select: {
          id: true,
          platform: true,
          title: true
        }
      }
    };
  }

  private getReminderSelect() {
    return {
      id: true,
      caseId: true,
      remindAt: true,
      message: true,
      sentAt: true,
      completedAt: true,
      createdAt: true
    };
  }

  private parseFutureReminderDate(value: string) {
    const remindAt = new Date(value);

    if (Number.isNaN(remindAt.getTime()) || remindAt.getTime() <= Date.now()) {
      throw new BadRequestException("Reminder time must be a valid future date.");
    }

    return remindAt;
  }
}
