import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DocumentStatus, Prisma } from "@proofpilot/database";
import { buildCaseAccessWhere } from "../common/case-access.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { CaseAccessGuard } from "./case-access.guard.js";
import type { CaseRecordsService } from "./case-records.service.js";
import { timelineEventSelect, timelineQuery } from "./case-selects.js";
import { analyzeTimelineEvidence } from "./case-timeline-analysis.js";
import type { CreateTimelineEventDto } from "./dto/create-timeline-event.dto.js";
import type { ReorderTimelineEventsDto } from "./dto/reorder-timeline-events.dto.js";
import type { UpdateTimelineEventDto } from "./dto/update-timeline-event.dto.js";

/** Owns manual and evidence-derived timeline operations. */
export class CaseTimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CaseAccessGuard,
    private readonly records: CaseRecordsService
  ) {}

  /** Lists timeline events in their persisted user-defined order. */
  async list(userId: string, caseId: string) {
    await this.access.require(userId, caseId, "READ");

    return this.prisma.caseEvent.findMany({
      where: { caseId },
      ...timelineQuery
    });
  }

  /** Creates an event at its chronological insertion point. */
  async create(userId: string, caseId: string, input: CreateTimelineEventDto) {
    await this.access.require(userId, caseId, "EDIT");

    const title = input.title.trim();
    const description = input.description?.trim();
    const documentIds = input.documentIds ?? [];
    const occurredAt = new Date(input.occurredAt);

    if (!title) {
      throw new BadRequestException("Timeline event title is required.");
    }

    await this.access.requireTimelineDocuments(caseId, documentIds);

    return this.prisma.$transaction(async (tx) => {
      const nextChronologicalEvent = await tx.caseEvent.findFirst({
        where: {
          caseId,
          occurredAt: { gt: occurredAt }
        },
        orderBy: [{ sortOrder: "asc" }, { occurredAt: "asc" }, { id: "asc" }],
        select: { sortOrder: true }
      });
      const latestOrder = nextChronologicalEvent
        ? null
        : await tx.caseEvent.aggregate({
            where: { caseId },
            _max: { sortOrder: true }
          });
      const sortOrder = nextChronologicalEvent?.sortOrder ?? (latestOrder?._max.sortOrder ?? -1) + 1;

      // Open a single slot so existing custom ordering remains stable.
      if (nextChronologicalEvent) {
        await tx.caseEvent.updateMany({
          where: {
            caseId,
            sortOrder: { gte: sortOrder }
          },
          data: {
            sortOrder: { increment: 1 }
          }
        });
      }

      const event = await tx.caseEvent.create({
        data: {
          caseId,
          sortOrder,
          occurredAt,
          title,
          ...(description ? { description } : {}),
          confidence: null,
          ...(documentIds.length
            ? {
                sources: {
                  create: documentIds.map((documentId) => ({ documentId }))
                }
              }
            : {})
        },
        select: timelineEventSelect
      });

      await tx.auditLog.create({
        data: {
          userId,
          caseId,
          action: "case.timeline_event_created",
          metadata: {
            eventId: event.id,
            occurredAt: event.occurredAt.toISOString(),
            sourceCount: documentIds.length,
            title
          }
        }
      });

      return event;
    });
  }

  /** Updates event fields and atomically replaces evidence links when supplied. */
  async update(
    userId: string,
    caseId: string,
    eventId: string,
    input: UpdateTimelineEventDto
  ) {
    await this.access.require(userId, caseId, "EDIT");
    const existingEvent = await this.prisma.caseEvent.findFirst({
      where: {
        id: eventId,
        caseId
      },
      select: {
        id: true,
        title: true
      }
    });

    if (!existingEvent) {
      throw new NotFoundException("Timeline event not found.");
    }

    const updatedFields = [
      input.occurredAt !== undefined ? "occurredAt" : null,
      input.title !== undefined ? "title" : null,
      input.description !== undefined ? "description" : null,
      input.documentIds !== undefined ? "sources" : null
    ].filter((field): field is string => field !== null);

    if (!updatedFields.length) {
      throw new BadRequestException("Add at least one timeline event change.");
    }

    const title = input.title?.trim();
    const description = input.description?.trim() || null;
    const documentIds = input.documentIds ?? [];

    if (input.title !== undefined && !title) {
      throw new BadRequestException("Timeline event title is required.");
    }

    if (input.documentIds !== undefined) {
      await this.access.requireTimelineDocuments(caseId, documentIds);
    }

    return this.prisma.$transaction(async (tx) => {
      if (
        input.occurredAt !== undefined ||
        input.title !== undefined ||
        input.description !== undefined
      ) {
        const eventUpdate: Prisma.CaseEventUncheckedUpdateInput = {};

        if (input.occurredAt !== undefined) {
          eventUpdate.occurredAt = new Date(input.occurredAt);
        }

        if (input.title !== undefined) {
          eventUpdate.title = input.title.trim();
        }

        if (input.description !== undefined) {
          eventUpdate.description = description;
        }

        await tx.caseEvent.update({
          where: { id: eventId },
          data: eventUpdate
        });
      }

      if (input.documentIds !== undefined) {
        await tx.eventSource.deleteMany({ where: { eventId } });

        if (documentIds.length) {
          await tx.eventSource.createMany({
            data: documentIds.map((documentId) => ({
              eventId,
              documentId
            }))
          });
        }
      }

      const event = await tx.caseEvent.findUniqueOrThrow({
        where: { id: eventId },
        select: timelineEventSelect
      });

      await tx.auditLog.create({
        data: {
          userId,
          caseId,
          action: "case.timeline_event_updated",
          metadata: {
            eventId,
            title: event.title,
            updatedFields
          }
        }
      });

      return event;
    });
  }

  /** Deletes one timeline event after verifying case-scoped ownership. */
  async remove(userId: string, caseId: string, eventId: string) {
    await this.access.require(userId, caseId, "EDIT");
    const existingEvent = await this.prisma.caseEvent.findFirst({
      where: {
        id: eventId,
        caseId
      },
      select: {
        id: true,
        title: true
      }
    });

    if (!existingEvent) {
      throw new NotFoundException("Timeline event not found.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.caseEvent.delete({ where: { id: eventId } });
      await tx.auditLog.create({
        data: {
          userId,
          caseId,
          action: "case.timeline_event_deleted",
          metadata: {
            eventId,
            title: existingEvent.title
          }
        }
      });
    });

    return { id: eventId };
  }

  /** Rewrites the complete timeline order after validating an exact ID permutation. */
  async reorder(userId: string, caseId: string, input: ReorderTimelineEventsDto) {
    await this.access.require(userId, caseId, "EDIT");

    const events = await this.prisma.caseEvent.findMany({
      where: { caseId },
      select: { id: true }
    });
    const ownedEventIds = new Set(events.map((event) => event.id));

    if (
      new Set(input.eventIds).size !== input.eventIds.length ||
      input.eventIds.length !== events.length ||
      input.eventIds.some((eventId) => !ownedEventIds.has(eventId))
    ) {
      throw new BadRequestException("Timeline order must include every event in this case once.");
    }

    return this.prisma.$transaction(async (tx) => {
      for (const [sortOrder, eventId] of input.eventIds.entries()) {
        await tx.caseEvent.update({
          where: { id: eventId },
          data: { sortOrder }
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          caseId,
          action: "case.timeline_reordered",
          metadata: {
            eventCount: input.eventIds.length
          }
        }
      });

      return tx.caseEvent.findMany({
        where: { caseId },
        ...timelineQuery
      });
    });
  }

  /** Rebuilds machine-derived events from processed evidence while preserving manual entries. */
  async analyze(userId: string, caseId: string) {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        ...buildCaseAccessWhere(userId, "EDIT"),
        archivedAt: null
      },
      select: {
        id: true,
        documents: {
          where: {
            status: DocumentStatus.PROCESSED,
            extractedText: {
              not: null
            }
          },
          select: {
            id: true,
            originalName: true,
            extractedText: true,
            entities: {
              select: {
                type: true,
                value: true
              }
            }
          }
        }
      }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    const analyzedEvents = analyzeTimelineEvidence(foundCase.documents);

    await this.prisma.$transaction(async (tx) => {
      // Confidence is only populated for generated events, making regeneration idempotent.
      await tx.caseEvent.deleteMany({
        where: {
          caseId: foundCase.id,
          confidence: { not: null }
        }
      });

      for (const event of analyzedEvents) {
        await tx.caseEvent.create({
          data: {
            caseId: foundCase.id,
            sortOrder: 0,
            occurredAt: event.occurredAt,
            title: event.title,
            description: event.description,
            confidence: event.confidence,
            sources: {
              create: {
                documentId: event.documentId
              }
            }
          }
        });
      }

      const chronologicalEvents = await tx.caseEvent.findMany({
        where: { caseId: foundCase.id },
        orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: { id: true }
      });

      for (const [sortOrder, event] of chronologicalEvents.entries()) {
        await tx.caseEvent.update({
          where: { id: event.id },
          data: { sortOrder }
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          caseId: foundCase.id,
          action: "case.timeline_analyzed",
          metadata: {
            documentsAnalyzed: foundCase.documents.length,
            eventCount: analyzedEvents.length
          }
        }
      });
    });

    return this.records.get(userId, caseId);
  }
}
