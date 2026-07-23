import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, randomInt } from "node:crypto";
import {
  PacketSharePermission as DatabasePacketSharePermission,
  Prisma
} from "@proofpilot/database";
import { createPresignedDownloadUrl } from "@proofpilot/storage";
import {
  hashPacketShareAccessCode,
  verifyPacketShareAccessCode,
  verifyPacketShareRecipientToken
} from "@proofpilot/types/packet-share-security";
import type {
  PacketShareAccessRequestResponse,
  PacketShareAccessResponse,
  PacketShareCommentRecord,
  PacketShareContentResponse,
  PacketSharePermission,
  PublicPacketShareMetadata
} from "@proofpilot/types";
import { getApiEnv } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AccessPacketShareDto } from "./dto/access-packet-share.dto.js";
import type { CreatePacketShareCommentDto } from "./dto/create-packet-share-comment.dto.js";
import type { VerifyPacketShareAccessDto } from "./dto/verify-packet-share-access.dto.js";
import { PacketShareMailerService } from "./packet-share-mailer.service.js";

const accessLifetimeMs = 60 * 60 * 1_000;
const challengeLifetimeMs = 10 * 60 * 1_000;
const challengeCooldownMs = 60 * 1_000;
const maximumChallengeAttempts = 5;

const publicShareSelect = {
  id: true,
  createdById: true,
  expiresAt: true,
  requireEmailVerification: true,
  revokedAt: true,
  packetExport: {
    select: {
      byteSize: true,
      createdAt: true,
      storageKey: true,
      packet: {
        select: {
          id: true,
          case: {
            select: {
              id: true,
              title: true
            }
          }
        }
      }
    }
  },
  recipients: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      email: true,
      permission: true,
      lastAccessedAt: true
    }
  }
} satisfies Prisma.PacketShareSelect;

type PublicShareRecord = Prisma.PacketShareGetPayload<{
  select: typeof publicShareSelect;
}>;

interface PacketShareAccessPayload {
  shareId: string;
  sub: string;
  type: "packet-share-access";
}

interface LoadedPublicShare {
  constrainedRecipientId: string | null;
  share: PublicShareRecord;
}

@Injectable()
export class PacketShareAccessService {
  private readonly env = getApiEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly packetShareMailer: PacketShareMailerService
  ) {}

  async getPublicMetadata(rawToken: string): Promise<PublicPacketShareMetadata> {
    const { share } = await this.loadActiveShare(rawToken);

    return {
      expiresAt: share.expiresAt?.toISOString() ?? null,
      requireEmailVerification: share.requireEmailVerification
    };
  }

  async requestAccess(
    input: AccessPacketShareDto
  ): Promise<PacketShareAccessRequestResponse> {
    const loaded = await this.loadActiveShare(input.token);
    const recipient = this.findRecipient(loaded, input.email);

    if (!loaded.share.requireEmailVerification) {
      return {
        access: await this.issueAccess(loaded.share, recipient),
        status: "ACCESS_GRANTED"
      };
    }

    const now = new Date();
    const recentChallenge = await this.prisma.packetShareAccessChallenge.findFirst({
      where: {
        consumedAt: null,
        createdAt: { gt: new Date(now.getTime() - challengeCooldownMs) },
        expiresAt: { gt: now },
        recipientId: recipient.id,
        shareId: loaded.share.id
      },
      orderBy: { createdAt: "desc" },
      select: { id: true }
    });

    if (recentChallenge) {
      throw new HttpException(
        "A verification code was sent recently. Wait a moment before requesting another.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const challengeId = randomBytes(18).toString("base64url");
    const code = randomInt(100_000, 1_000_000).toString();
    const expiresAt = new Date(now.getTime() + challengeLifetimeMs);

    await this.prisma.packetShareAccessChallenge.create({
      data: {
        codeHash: hashPacketShareAccessCode(
          challengeId,
          code,
          this.env.JWT_SECRET
        ),
        expiresAt,
        id: challengeId,
        recipientId: recipient.id,
        shareId: loaded.share.id
      }
    });

    try {
      await this.packetShareMailer.sendAccessCode({
        challengeId,
        code,
        expiresAt,
        packetTitle: loaded.share.packetExport.packet.case.title,
        to: recipient.email
      });
    } catch {
      await this.prisma.packetShareAccessChallenge.deleteMany({
        where: { consumedAt: null, id: challengeId }
      });
      throw new ServiceUnavailableException(
        "The verification code could not be delivered. Try again shortly."
      );
    }

    await this.prisma.auditLog.create({
      data: {
        action: "case.packet_share_access_challenge_sent",
        caseId: loaded.share.packetExport.packet.case.id,
        metadata: {
          challengeId,
          deliveryMode: this.packetShareMailer.deliveryMode,
          recipientId: recipient.id,
          shareId: loaded.share.id
        },
        userId: loaded.share.createdById
      }
    });

    return {
      challengeId,
      deliveryMode: this.packetShareMailer.deliveryMode,
      ...(this.env.NODE_ENV !== "production" &&
      this.packetShareMailer.deliveryMode === "DEVELOPMENT_LOG"
        ? { developmentCode: code }
        : {}),
      expiresAt: expiresAt.toISOString(),
      status: "CODE_REQUIRED"
    };
  }

  async verifyAccess(
    input: VerifyPacketShareAccessDto
  ): Promise<PacketShareAccessResponse> {
    const loaded = await this.loadActiveShare(input.token);
    const recipient = this.findRecipient(loaded, input.email);
    const challenge = await this.prisma.packetShareAccessChallenge.findFirst({
      where: {
        id: input.challengeId,
        recipientId: recipient.id,
        shareId: loaded.share.id
      },
      select: {
        attemptCount: true,
        codeHash: true,
        consumedAt: true,
        expiresAt: true
      }
    });
    const now = new Date();

    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt <= now ||
      challenge.attemptCount >= maximumChallengeAttempts
    ) {
      throw new UnauthorizedException(
        "The verification code is expired or invalid. Request a new code."
      );
    }

    if (
      !verifyPacketShareAccessCode(
        input.challengeId,
        input.code,
        challenge.codeHash,
        this.env.JWT_SECRET
      )
    ) {
      await this.prisma.packetShareAccessChallenge.updateMany({
        where: {
          attemptCount: { lt: maximumChallengeAttempts },
          consumedAt: null,
          id: input.challengeId
        },
        data: { attemptCount: { increment: 1 } }
      });
      throw new UnauthorizedException("The verification code is invalid.");
    }

    const consumed = await this.prisma.$transaction(async (transaction) => {
      const challengeUpdate = await transaction.packetShareAccessChallenge.updateMany({
        where: {
          attemptCount: { lt: maximumChallengeAttempts },
          consumedAt: null,
          expiresAt: { gt: now },
          id: input.challengeId
        },
        data: {
          attemptCount: { increment: 1 },
          consumedAt: now
        }
      });

      if (!challengeUpdate.count) {
        return false;
      }

      await transaction.packetShareRecipient.update({
        where: { id: recipient.id },
        data: { lastAccessedAt: now }
      });
      await transaction.auditLog.create({
        data: {
          action: "case.packet_share_access_verified",
          caseId: loaded.share.packetExport.packet.case.id,
          metadata: {
            challengeId: input.challengeId,
            recipientId: recipient.id,
            shareId: loaded.share.id
          },
          userId: loaded.share.createdById
        }
      });

      return true;
    });

    if (!consumed) {
      throw new UnauthorizedException(
        "The verification code is expired or invalid. Request a new code."
      );
    }

    return this.signAccess(loaded.share, recipient);
  }

  async getContent(
    rawToken: string,
    accessToken: string
  ): Promise<PacketShareContentResponse> {
    const { recipient, share } = await this.authorize(rawToken, accessToken);
    const fileName = toPacketFileName(share.packetExport.packet.case.title);
    const [viewUrl, downloadUrl, comments] = await Promise.all([
      createPresignedDownloadUrl({
        disposition: "inline",
        expiresInSeconds: 300,
        fileName,
        key: share.packetExport.storageKey
      }),
      recipient.permission === DatabasePacketSharePermission.DOWNLOAD
        ? createPresignedDownloadUrl({
            disposition: "attachment",
            expiresInSeconds: 300,
            fileName,
            key: share.packetExport.storageKey
          })
        : Promise.resolve(null),
      this.prisma.packetShareComment.findMany({
        where: { shareId: share.id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 100,
        select: {
          id: true,
          recipientId: true,
          content: true,
          createdAt: true
        }
      })
    ]);

    return {
      comments: comments.map((comment) => ({
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        id: comment.id,
        isOwn: comment.recipientId === recipient.id
      })),
      downloadUrl,
      packet: {
        byteSize: share.packetExport.byteSize,
        createdAt: share.packetExport.createdAt.toISOString(),
        title: share.packetExport.packet.case.title
      },
      permission: recipient.permission as PacketSharePermission,
      viewUrl
    };
  }

  async addComment(
    rawToken: string,
    accessToken: string,
    input: CreatePacketShareCommentDto
  ): Promise<PacketShareCommentRecord> {
    const { recipient, share } = await this.authorize(rawToken, accessToken);

    if (recipient.permission === DatabasePacketSharePermission.VIEW) {
      throw new ForbiddenException("This recipient can view but cannot comment.");
    }

    const content = input.content.trim();

    if (!content) {
      throw new BadRequestException("Comment cannot be blank.");
    }

    const comment = await this.prisma.packetShareComment.create({
      data: {
        content,
        recipientId: recipient.id,
        shareId: share.id
      },
      select: {
        id: true,
        content: true,
        createdAt: true
      }
    });

    return {
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      id: comment.id,
      isOwn: true
    };
  }

  private async authorize(rawToken: string, accessToken: string) {
    if (!accessToken) {
      throw new UnauthorizedException("Packet share access is required.");
    }

    let payload: PacketShareAccessPayload;

    try {
      payload = await this.jwtService.verifyAsync<PacketShareAccessPayload>(accessToken);
    } catch {
      throw new UnauthorizedException("Packet share access has expired or is invalid.");
    }

    if (payload.type !== "packet-share-access" || !payload.shareId || !payload.sub) {
      throw new UnauthorizedException("Packet share access is invalid.");
    }

    const loaded = await this.loadActiveShare(rawToken);
    const recipient = loaded.share.recipients.find(
      (candidate) => candidate.id === payload.sub
    );

    if (
      loaded.share.id !== payload.shareId ||
      !recipient ||
      (loaded.constrainedRecipientId &&
        loaded.constrainedRecipientId !== recipient.id)
    ) {
      throw new UnauthorizedException("Packet share access is invalid.");
    }

    return { recipient, share: loaded.share };
  }

  private async loadActiveShare(rawToken: string): Promise<LoadedPublicShare> {
    const signedRecipient = verifyPacketShareRecipientToken(
      rawToken,
      this.env.JWT_SECRET
    );
    const share = signedRecipient
      ? await this.prisma.packetShare.findUnique({
          where: { id: signedRecipient.shareId },
          select: publicShareSelect
        })
      : await this.prisma.packetShare.findUnique({
          where: { tokenHash: hashToken(rawToken) },
          select: publicShareSelect
        });

    if (!share || share.revokedAt) {
      throw new NotFoundException("Shared packet not found.");
    }

    if (share.expiresAt && share.expiresAt <= new Date()) {
      throw new GoneException("This shared packet link has expired.");
    }

    if (
      signedRecipient &&
      !share.recipients.some(
        (recipient) => recipient.id === signedRecipient.recipientId
      )
    ) {
      throw new NotFoundException("Shared packet not found.");
    }

    return {
      constrainedRecipientId: signedRecipient?.recipientId ?? null,
      share
    };
  }

  private findRecipient(loaded: LoadedPublicShare, rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const recipient = loaded.share.recipients.find(
      (candidate) =>
        candidate.email === email &&
        (!loaded.constrainedRecipientId ||
          candidate.id === loaded.constrainedRecipientId)
    );

    if (!recipient) {
      throw new UnauthorizedException(
        "This email is not authorized for the shared packet."
      );
    }

    return recipient;
  }

  private async issueAccess(
    share: PublicShareRecord,
    recipient: PublicShareRecord["recipients"][number]
  ) {
    await this.prisma.packetShareRecipient.update({
      where: { id: recipient.id },
      data: { lastAccessedAt: new Date() }
    });

    return this.signAccess(share, recipient);
  }

  private async signAccess(
    share: PublicShareRecord,
    recipient: PublicShareRecord["recipients"][number]
  ): Promise<PacketShareAccessResponse> {
    const expiresAt = new Date(
      Math.min(
        Date.now() + accessLifetimeMs,
        share.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER
      )
    );
    const expiresIn = Math.max(
      1,
      Math.floor((expiresAt.getTime() - Date.now()) / 1_000)
    );
    const accessToken = await this.jwtService.signAsync(
      {
        shareId: share.id,
        sub: recipient.id,
        type: "packet-share-access"
      } satisfies PacketShareAccessPayload,
      { expiresIn }
    );

    return {
      accessToken,
      expiresAt: expiresAt.toISOString(),
      permission: recipient.permission as PacketSharePermission
    };
  }
}

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function toPacketFileName(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${slug || "proofpilot-case"}-packet.pdf`;
}
