import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes } from "node:crypto";
import {
  CaseCollaboratorStatus,
  PacketSharePermission as DatabasePacketSharePermission,
  PacketStatus,
  Prisma
} from "@proofpilot/database";
import { createPresignedDownloadUrl } from "@proofpilot/storage";
import type {
  PacketShareAccessResponse,
  PacketShareCapabilities,
  PacketShareCommentRecord,
  PacketShareContentResponse,
  PacketShareCreatedResponse,
  PacketSharePacketSummary,
  PacketSharePermission,
  PacketSharePreparationResponse,
  PacketShareRevokedResponse,
  PublicPacketShareMetadata
} from "@proofpilot/types";
import { getApiEnv } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AccessPacketShareDto } from "./dto/access-packet-share.dto.js";
import type { CreatePacketShareCommentDto } from "./dto/create-packet-share-comment.dto.js";
import type { CreatePacketShareDto } from "./dto/create-packet-share.dto.js";

const maximumShareLifetimeMs = 365 * 24 * 60 * 60 * 1000;
const minimumShareLifetimeMs = 5 * 60 * 1000;
const accessLifetimeMs = 60 * 60 * 1000;

const packetShareCapabilities = {
  comments: true,
  emailDelivery: false,
  emailVerification: false,
  watermarking: false
} satisfies PacketShareCapabilities;

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

@Injectable()
export class PacketSharingService {
  private readonly webOrigin = getApiEnv().WEB_ORIGIN.replace(/\/$/, "");

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async prepare(ownerId: string, caseId: string): Promise<PacketSharePreparationResponse> {
    const foundCase = await this.prisma.case.findFirst({
      where: {
        archivedAt: null,
        id: caseId,
        ownerId
      },
      select: {
        title: true,
        collaborators: {
          where: { status: CaseCollaboratorStatus.ACTIVE },
          orderBy: { name: "asc" },
          select: {
            email: true,
            name: true
          }
        },
        packets: {
          where: { status: PacketStatus.READY },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: {
            id: true,
            exports: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                byteSize: true,
                createdAt: true
              }
            }
          }
        },
        packetShares: {
          where: {
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
            _count: { select: { recipients: true } }
          }
        }
      }
    });

    if (!foundCase) {
      throw new NotFoundException("Case not found.");
    }

    const packet = foundCase.packets[0];
    const packetExport = packet?.exports[0];

    return {
      activeShares: foundCase.packetShares.map((share) => ({
        createdAt: share.createdAt.toISOString(),
        expiresAt: share.expiresAt?.toISOString() ?? null,
        id: share.id,
        recipientCount: share._count.recipients
      })),
      capabilities: packetShareCapabilities,
      packet:
        packet && packetExport
          ? {
              byteSize: packetExport.byteSize,
              createdAt: packetExport.createdAt.toISOString(),
              exportId: packetExport.id,
              packetId: packet.id,
              title: foundCase.title
            }
          : null,
      suggestedRecipients: foundCase.collaborators
    };
  }

  async revoke(
    ownerId: string,
    caseId: string,
    shareId: string
  ): Promise<PacketShareRevokedResponse> {
    const share = await this.prisma.packetShare.findFirst({
      where: {
        id: shareId,
        caseId,
        revokedAt: null,
        case: {
          archivedAt: null,
          ownerId
        }
      },
      select: { id: true }
    });

    if (!share) {
      throw new NotFoundException("Active packet share not found.");
    }

    const revokedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.packetShare.update({
        where: { id: share.id },
        data: { revokedAt }
      });
      await tx.auditLog.create({
        data: {
          action: "case.packet_share_revoked",
          caseId,
          userId: ownerId,
          metadata: { shareId: share.id }
        }
      });
    });

    return {
      id: share.id,
      revokedAt: revokedAt.toISOString()
    };
  }

  async create(
    ownerId: string,
    caseId: string,
    input: CreatePacketShareDto
  ): Promise<PacketShareCreatedResponse> {
    this.assertSupportedSecurityOptions(input);
    const expiresAt = this.parseExpiration(input.expiresAt);
    const recipients = this.normalizeRecipients(input.recipients);
    const packetExport = await this.prisma.packetExport.findFirst({
      where: {
        id: input.packetExportId,
        packet: {
          status: PacketStatus.READY,
          case: {
            archivedAt: null,
            id: caseId,
            ownerId
          }
        }
      },
      select: {
        id: true,
        byteSize: true,
        createdAt: true,
        storageKey: true,
        packet: {
          select: {
            id: true,
            case: {
              select: {
                owner: { select: { email: true } },
                title: true
              }
            }
          }
        }
      }
    });

    if (!packetExport) {
      throw new NotFoundException("Ready packet export not found.");
    }

    const ownerEmail = packetExport.packet.case.owner.email.trim().toLowerCase();

    if (recipients.some((recipient) => recipient.email === ownerEmail)) {
      throw new BadRequestException("The case owner does not need a recipient share link.");
    }

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const share = await this.prisma.$transaction(async (tx) => {
      const createdShare = await tx.packetShare.create({
        data: {
          caseId,
          createdById: ownerId,
          expiresAt,
          packetExportId: packetExport.id,
          requireEmailVerification: false,
          tokenHash,
          watermarkDocuments: false,
          recipients: {
            create: recipients
          }
        },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          requireEmailVerification: true,
          watermarkDocuments: true,
          recipients: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              email: true,
              permission: true,
              lastAccessedAt: true
            }
          }
        }
      });

      await tx.auditLog.create({
        data: {
          action: "case.packet_share_created",
          caseId,
          userId: ownerId,
          metadata: {
            expiresAt: expiresAt?.toISOString() ?? null,
            packetExportId: packetExport.id,
            permissions: [...new Set(recipients.map((recipient) => recipient.permission))],
            recipientCount: recipients.length,
            shareId: createdShare.id
          }
        }
      });

      return createdShare;
    });
    const ownerDownloadUrl = await createPresignedDownloadUrl({
      disposition: "attachment",
      expiresInSeconds: 900,
      fileName: toPacketFileName(packetExport.packet.case.title),
      key: packetExport.storageKey
    });

    return {
      capabilities: packetShareCapabilities,
      createdAt: share.createdAt.toISOString(),
      deliveryMode: "LINK_ONLY",
      expiresAt: share.expiresAt?.toISOString() ?? null,
      id: share.id,
      ownerDownloadUrl,
      packet: this.toPacketSummary(packetExport, packetExport.packet.case.title),
      recipients: share.recipients.map((recipient) => ({
        email: recipient.email,
        id: recipient.id,
        lastAccessedAt: recipient.lastAccessedAt?.toISOString() ?? null,
        permission: recipient.permission as PacketSharePermission
      })),
      requireEmailVerification: share.requireEmailVerification,
      shareUrl: `${this.webOrigin}/shared-packet#${rawToken}`,
      watermarkDocuments: share.watermarkDocuments
    };
  }

  async getPublicMetadata(rawToken: string): Promise<PublicPacketShareMetadata> {
    const share = await this.loadActiveShare(rawToken);

    return {
      expiresAt: share.expiresAt?.toISOString() ?? null,
      requireEmailVerification: share.requireEmailVerification
    };
  }

  async createAccess(input: AccessPacketShareDto): Promise<PacketShareAccessResponse> {
    const share = await this.loadActiveShare(input.token);

    if (share.requireEmailVerification) {
      throw new ServiceUnavailableException(
        "Email verification is not configured for packet sharing."
      );
    }

    const email = input.email.trim().toLowerCase();
    const recipient = share.recipients.find((candidate) => candidate.email === email);

    if (!recipient) {
      throw new UnauthorizedException("This email is not authorized for the shared packet.");
    }

    const expiresAt = new Date(
      Math.min(Date.now() + accessLifetimeMs, share.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER)
    );
    const expiresIn = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    const accessToken = await this.jwtService.signAsync(
      {
        shareId: share.id,
        sub: recipient.id,
        type: "packet-share-access"
      } satisfies PacketShareAccessPayload,
      { expiresIn }
    );

    await this.prisma.packetShareRecipient.update({
      where: { id: recipient.id },
      data: { lastAccessedAt: new Date() }
    });

    return {
      accessToken,
      expiresAt: expiresAt.toISOString(),
      permission: recipient.permission as PacketSharePermission
    };
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
      packet: this.toPublicPacketSummary(share),
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

    const share = await this.loadActiveShare(rawToken);
    const recipient = share.recipients.find((candidate) => candidate.id === payload.sub);

    if (share.id !== payload.shareId || !recipient) {
      throw new UnauthorizedException("Packet share access is invalid.");
    }

    return { recipient, share };
  }

  private async loadActiveShare(rawToken: string): Promise<PublicShareRecord> {
    const share = await this.prisma.packetShare.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      select: publicShareSelect
    });

    if (!share || share.revokedAt) {
      throw new NotFoundException("Shared packet not found.");
    }

    if (share.expiresAt && share.expiresAt <= new Date()) {
      throw new GoneException("This shared packet link has expired.");
    }

    return share;
  }

  private assertSupportedSecurityOptions(input: CreatePacketShareDto) {
    if (input.requireEmailVerification) {
      throw new BadRequestException(
        "Email verification requires a configured delivery provider."
      );
    }

    if (input.watermarkDocuments) {
      throw new BadRequestException(
        "Packet watermarking requires a configured watermark processor."
      );
    }
  }

  private normalizeRecipients(recipients: CreatePacketShareDto["recipients"]) {
    const normalized = recipients.map((recipient) => ({
      email: recipient.email.trim().toLowerCase(),
      permission: recipient.permission as DatabasePacketSharePermission
    }));
    const uniqueEmails = new Set(normalized.map((recipient) => recipient.email));

    if (uniqueEmails.size !== normalized.length) {
      throw new BadRequestException("Each packet recipient must have a unique email address.");
    }

    return normalized;
  }

  private parseExpiration(value: string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    const expiresAt = new Date(value);
    const lifetimeMs = expiresAt.getTime() - Date.now();

    if (!Number.isFinite(expiresAt.getTime()) || lifetimeMs < minimumShareLifetimeMs) {
      throw new BadRequestException("Packet share expiration must be at least five minutes away.");
    }

    if (lifetimeMs > maximumShareLifetimeMs) {
      throw new BadRequestException("Packet share expiration cannot exceed one year.");
    }

    return expiresAt;
  }

  private toPacketSummary(
    packetExport: {
      byteSize: number | null;
      createdAt: Date;
      id: string;
      packet: { id: string };
    },
    title: string
  ): PacketSharePacketSummary {
    return {
      byteSize: packetExport.byteSize,
      createdAt: packetExport.createdAt.toISOString(),
      exportId: packetExport.id,
      packetId: packetExport.packet.id,
      title
    };
  }

  private toPublicPacketSummary(share: PublicShareRecord) {
    return {
      byteSize: share.packetExport.byteSize,
      createdAt: share.packetExport.createdAt.toISOString(),
      title: share.packetExport.packet.case.title
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
