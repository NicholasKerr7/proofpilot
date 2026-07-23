import { Injectable } from "@nestjs/common";
import { CaseAccessGuard } from "./case-access.guard.js";
import { CaseChecklistService } from "./case-checklist.service.js";
import { CasePacketsService } from "./case-packets.service.js";
import { CaseProofMapService } from "./case-proof-map.service.js";
import { CaseRecordsService } from "./case-records.service.js";
import { CaseStatementsService } from "./case-statements.service.js";
import { CaseSubmissionsService } from "./case-submissions.service.js";
import { CaseTimelineService } from "./case-timeline.service.js";
import type { CreateCaseSubmissionDto } from "./dto/create-case-submission.dto.js";
import type { CreateSubmissionUpdateDto } from "./dto/create-submission-update.dto.js";
import type { CreateCaseDto } from "./dto/create-case.dto.js";
import type { CreateTimelineEventDto } from "./dto/create-timeline-event.dto.js";
import type { ListCaseActivityQueryDto } from "./dto/list-case-activity-query.dto.js";
import type { ReorderTimelineEventsDto } from "./dto/reorder-timeline-events.dto.js";
import type { SaveStatementGuidanceDto } from "./dto/save-statement-guidance.dto.js";
import type { SaveStatementDto } from "./dto/save-statement.dto.js";
import type { UpdateCaseDto } from "./dto/update-case.dto.js";
import type { UpdateChecklistItemDto } from "./dto/update-checklist-item.dto.js";
import type { UpdateTimelineEventDto } from "./dto/update-timeline-event.dto.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { PacketGenerationQueueService } from "../queue/packet-generation-queue.service.js";

/**
 * Stable controller-facing facade for case workflows.
 *
 * Domain services remain internal so callers keep one API while each workflow
 * has an isolated ownership boundary and focused test surface.
 */
@Injectable()
export class CasesService {
  private readonly records: CaseRecordsService;
  private readonly timeline: CaseTimelineService;
  private readonly checklist: CaseChecklistService;
  private readonly statements: CaseStatementsService;
  private readonly submissions: CaseSubmissionsService;
  private readonly packets: CasePacketsService;
  private readonly proofMap: CaseProofMapService;

  constructor(
    prisma: PrismaService,
    packetGenerationQueue: PacketGenerationQueueService
  ) {
    const access = new CaseAccessGuard(prisma);

    this.records = new CaseRecordsService(prisma, access);
    this.timeline = new CaseTimelineService(prisma, access, this.records);
    this.checklist = new CaseChecklistService(prisma, access, this.records);
    this.statements = new CaseStatementsService(prisma, access);
    this.packets = new CasePacketsService(prisma, packetGenerationQueue, access);
    this.proofMap = new CaseProofMapService(prisma, access);
    this.submissions = new CaseSubmissionsService(prisma, access);
  }

  async create(ownerId: string, input: CreateCaseDto) {
    return this.records.create(ownerId, input);
  }

  async list(userId: string) {
    return this.records.list(userId);
  }

  async get(userId: string, caseId: string) {
    return this.records.get(userId, caseId);
  }

  async listActivity(userId: string, caseId: string, query: ListCaseActivityQueryDto) {
    return this.records.listActivity(userId, caseId, query);
  }

  async listTimeline(userId: string, caseId: string) {
    return this.timeline.list(userId, caseId);
  }

  async createTimelineEvent(userId: string, caseId: string, input: CreateTimelineEventDto) {
    return this.timeline.create(userId, caseId, input);
  }

  async updateTimelineEvent(
    userId: string,
    caseId: string,
    eventId: string,
    input: UpdateTimelineEventDto
  ) {
    return this.timeline.update(userId, caseId, eventId, input);
  }

  async deleteTimelineEvent(userId: string, caseId: string, eventId: string) {
    return this.timeline.remove(userId, caseId, eventId);
  }

  async reorderTimeline(userId: string, caseId: string, input: ReorderTimelineEventsDto) {
    return this.timeline.reorder(userId, caseId, input);
  }

  async analyzeTimeline(userId: string, caseId: string) {
    return this.timeline.analyze(userId, caseId);
  }

  async listChecklist(userId: string, caseId: string) {
    return this.checklist.list(userId, caseId);
  }

  async getProofMap(userId: string, caseId: string) {
    return this.proofMap.get(userId, caseId);
  }

  async listSubmissions(userId: string, caseId: string) {
    return this.submissions.list(userId, caseId);
  }

  async createSubmission(
    userId: string,
    caseId: string,
    input: CreateCaseSubmissionDto
  ) {
    return this.submissions.create(userId, caseId, input);
  }

  async addSubmissionUpdate(
    userId: string,
    caseId: string,
    submissionId: string,
    input: CreateSubmissionUpdateDto
  ) {
    return this.submissions.addUpdate(userId, caseId, submissionId, input);
  }

  async analyzeChecklist(userId: string, caseId: string) {
    return this.checklist.analyze(userId, caseId);
  }

  async updateChecklistItem(
    userId: string,
    caseId: string,
    itemId: string,
    input: UpdateChecklistItemDto
  ) {
    return this.checklist.update(userId, caseId, itemId, input);
  }

  async getStatement(userId: string, caseId: string) {
    return this.statements.get(userId, caseId);
  }

  async saveStatement(userId: string, caseId: string, input: SaveStatementDto) {
    return this.statements.save(userId, caseId, input);
  }

  async saveStatementGuidance(
    userId: string,
    caseId: string,
    input: SaveStatementGuidanceDto
  ) {
    return this.statements.saveGuidance(userId, caseId, input);
  }

  async generateStatement(userId: string, caseId: string) {
    return this.statements.generate(userId, caseId);
  }

  async restoreStatementVersion(userId: string, caseId: string, versionId: string) {
    return this.statements.restore(userId, caseId, versionId);
  }

  async generateSummary(userId: string, caseId: string) {
    return this.statements.generateSummary(userId, caseId);
  }

  async listPackets(userId: string, caseId: string) {
    return this.packets.list(userId, caseId);
  }

  async generatePacket(userId: string, caseId: string) {
    return this.packets.generate(userId, caseId);
  }

  async update(userId: string, caseId: string, input: UpdateCaseDto) {
    return this.records.update(userId, caseId, input);
  }

  async archive(userId: string, caseId: string) {
    return this.records.archive(userId, caseId);
  }
}
