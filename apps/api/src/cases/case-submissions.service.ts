import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  AppealSubmissionChannel as DatabaseSubmissionChannel,
  AppealSubmissionStatus as DatabaseSubmissionStatus,
  CaseStatus,
  Prisma,
  SubmissionUpdateType as DatabaseSubmissionUpdateType
} from "@proofpilot/database";
import {
  appealSubmissionChannels,
  appealSubmissionStatuses,
  submissionUpdateTypes,
  type AppealSubmissionChannel,
  type AppealSubmissionStatus,
  type SubmissionUpdateType
} from "@proofpilot/types";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { CaseAccessGuard } from "./case-access.guard.js";
import type { CreateCaseSubmissionDto } from "./dto/create-case-submission.dto.js";
import type { CreateSubmissionUpdateDto } from "./dto/create-submission-update.dto.js";

const submissionSelect = {
  caseId: true,
  channel: true,
  confirmationCode: true,
  createdAt: true,
  destination: true,
  id: true,
  notes: true,
  resolvedAt: true,
  responseDueAt: true,
  round: true,
  status: true,
  submittedAt: true,
  updatedAt: true,
  updates: {
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    select: {
      createdAt: true,
      details: true,
      id: true,
      occurredAt: true,
      status: true,
      submissionId: true,
      title: true,
      type: true
    }
  }
} satisfies Prisma.CaseSubmissionSelect;

/** Owns appeal-round submission records and their immutable response history. */
export class CaseSubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CaseAccessGuard
  ) {}

  async list(userId: string, caseId: string) {
    await this.access.require(userId, caseId, "READ");

    return this.prisma.caseSubmission.findMany({
      where: { caseId },
      orderBy: [{ round: "desc" }, { submittedAt: "desc" }],
      select: submissionSelect
    });
  }

  async create(
    userId: string,
    caseId: string,
    input: CreateCaseSubmissionDto
  ) {
    await this.access.require(userId, caseId, "EDIT");
    const channel = parseChannel(input.channel);
    const destination = requireText(input.destination, "Submission destination", 160);
    const submittedAt = parseDate(input.submittedAt, "Submission date");
    const responseDueAt = input.responseDueAt
      ? parseDate(input.responseDueAt, "Response deadline")
      : null;
    const confirmationCode = normalizeOptionalText(
      input.confirmationCode,
      "Confirmation number",
      120
    );
    const notes = normalizeOptionalText(input.notes, "Submission notes", 2000);

    if (responseDueAt && responseDueAt <= submittedAt) {
      throw new BadRequestException(
        "Response deadline must be after the submission date."
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const latestRound = await transaction.caseSubmission.aggregate({
        where: { caseId },
        _max: { round: true }
      });
      const round = (latestRound._max.round ?? 0) + 1;
      const submission = await transaction.caseSubmission.create({
        data: {
          caseId,
          channel: channel as DatabaseSubmissionChannel,
          confirmationCode,
          destination,
          notes,
          responseDueAt,
          round,
          status: DatabaseSubmissionStatus.SUBMITTED,
          submittedAt,
          updates: {
            create: {
              details: notes,
              occurredAt: submittedAt,
              status: DatabaseSubmissionStatus.SUBMITTED,
              title: `Round ${round} appeal submitted`,
              type: DatabaseSubmissionUpdateType.STATUS_CHANGE
            }
          }
        },
        select: submissionSelect
      });

      await transaction.case.update({
        where: { id: caseId },
        data: { status: CaseStatus.SUBMITTED }
      });
      await createResponseReminder(transaction, {
        caseId,
        responseDueAt,
        round
      });
      await transaction.auditLog.create({
        data: {
          action: "case.submission_created",
          caseId,
          metadata: {
            channel,
            confirmationCode,
            destination,
            responseDueAt: responseDueAt?.toISOString() ?? null,
            round,
            submissionId: submission.id
          },
          userId
        }
      });

      return submission;
    });
  }

  async addUpdate(
    userId: string,
    caseId: string,
    submissionId: string,
    input: CreateSubmissionUpdateDto
  ) {
    await this.access.require(userId, caseId, "EDIT");
    const submission = await this.prisma.caseSubmission.findFirst({
      where: {
        caseId,
        id: submissionId
      },
      select: {
        id: true,
        round: true,
        status: true
      }
    });

    if (!submission) {
      throw new NotFoundException("Submission not found.");
    }

    const type = parseUpdateType(input.type);
    const title = requireText(input.title, "Update title", 160);
    const details = normalizeOptionalText(input.details, "Update details", 2000);
    const occurredAt = parseDate(input.occurredAt, "Update date");
    const responseDueAt = input.responseDueAt
      ? parseDate(input.responseDueAt, "Response deadline")
      : undefined;
    const status = resolveUpdateStatus(type, input.status);

    if (responseDueAt && responseDueAt <= occurredAt) {
      throw new BadRequestException(
        "Response deadline must be after the update date."
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      await transaction.submissionUpdate.create({
        data: {
          details,
          occurredAt,
          status: status ? (status as DatabaseSubmissionStatus) : null,
          submissionId: submission.id,
          title,
          type: type as DatabaseSubmissionUpdateType
        }
      });

      if (status || responseDueAt !== undefined) {
        await transaction.caseSubmission.update({
          where: { id: submission.id },
          data: {
            ...(responseDueAt !== undefined ? { responseDueAt } : {}),
            ...(status
              ? {
                  resolvedAt: isResolvedSubmissionStatus(status)
                    ? occurredAt
                    : null,
                  status: status as DatabaseSubmissionStatus
                }
              : {})
          }
        });
      }

      const latestRound = await transaction.caseSubmission.aggregate({
        where: { caseId },
        _max: { round: true }
      });

      if (status && latestRound._max.round === submission.round) {
        await transaction.case.update({
          where: { id: caseId },
          data: { status: getCaseStatusForSubmission(status) }
        });
      }

      await createResponseReminder(transaction, {
        caseId,
        responseDueAt: responseDueAt ?? null,
        round: submission.round
      });
      await transaction.auditLog.create({
        data: {
          action: "case.submission_updated",
          caseId,
          metadata: {
            round: submission.round,
            status: status ?? submission.status,
            submissionId,
            title,
            type
          },
          userId
        }
      });

      return transaction.caseSubmission.findUniqueOrThrow({
        where: { id: submission.id },
        select: submissionSelect
      });
    });
  }
}

function parseChannel(value: string): AppealSubmissionChannel {
  if (!appealSubmissionChannels.includes(value as AppealSubmissionChannel)) {
    throw new BadRequestException("Submission channel is invalid.");
  }

  return value as AppealSubmissionChannel;
}

function parseUpdateType(value: string): SubmissionUpdateType {
  if (!submissionUpdateTypes.includes(value as SubmissionUpdateType)) {
    throw new BadRequestException("Submission update type is invalid.");
  }

  return value as SubmissionUpdateType;
}

function parseStatus(value: string): AppealSubmissionStatus {
  if (!appealSubmissionStatuses.includes(value as AppealSubmissionStatus)) {
    throw new BadRequestException("Submission status is invalid.");
  }

  return value as AppealSubmissionStatus;
}

function resolveUpdateStatus(
  type: SubmissionUpdateType,
  requestedStatus: string | undefined
): AppealSubmissionStatus | null {
  if (type === "ACKNOWLEDGEMENT") {
    return requestedStatus ? parseStatus(requestedStatus) : "ACKNOWLEDGED";
  }

  if (type === "INFORMATION_REQUEST") {
    return requestedStatus ? parseStatus(requestedStatus) : "ACTION_REQUIRED";
  }

  if (type === "DECISION") {
    const status = requestedStatus ? parseStatus(requestedStatus) : null;

    if (!status || !["APPROVED", "DENIED", "CLOSED"].includes(status)) {
      throw new BadRequestException(
        "Decision updates require an approved, denied, or closed status."
      );
    }

    return status;
  }

  if (type === "STATUS_CHANGE") {
    if (!requestedStatus) {
      throw new BadRequestException("Status updates require a submission status.");
    }

    return parseStatus(requestedStatus);
  }

  return requestedStatus ? parseStatus(requestedStatus) : null;
}

function getCaseStatusForSubmission(status: AppealSubmissionStatus) {
  if (status === "APPROVED" || status === "CLOSED") {
    return CaseStatus.RESOLVED;
  }

  if (status === "ACTION_REQUIRED") {
    return CaseStatus.NEEDS_MORE_EVIDENCE;
  }

  if (status === "DENIED") {
    return CaseStatus.READY_FOR_REVIEW;
  }

  return CaseStatus.SUBMITTED;
}

function isResolvedSubmissionStatus(status: AppealSubmissionStatus) {
  return status === "APPROVED" || status === "CLOSED" || status === "DENIED";
}

function parseDate(value: string, label: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${label} must be a valid date.`);
  }

  return date;
}

function requireText(value: string, label: string, maximumLength: number) {
  const normalized = value.trim();

  if (!normalized || normalized.length > maximumLength) {
    throw new BadRequestException(
      `${label} must be 1 to ${maximumLength} characters.`
    );
  }

  return normalized;
}

function normalizeOptionalText(
  value: string | undefined,
  label: string,
  maximumLength: number
) {
  return value === undefined
    ? null
    : requireText(value, label, maximumLength);
}

async function createResponseReminder(
  transaction: Prisma.TransactionClient,
  input: {
    caseId: string;
    responseDueAt: Date | null;
    round: number;
  }
) {
  if (!input.responseDueAt || input.responseDueAt <= new Date()) {
    return;
  }

  await transaction.reminder.create({
    data: {
      caseId: input.caseId,
      message: `Follow up on appeal round ${input.round} if no response has arrived.`,
      remindAt: input.responseDueAt
    }
  });
}
