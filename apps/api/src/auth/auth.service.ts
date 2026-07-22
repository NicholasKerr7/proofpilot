import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  AuthResponse,
  AuthUser,
  ChangePasswordResponse,
  PasswordResetRequestResponse,
  ResetPasswordResponse
} from "@proofpilot/types";
import { getApiEnv } from "../config/env.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { ChangePasswordDto } from "./dto/change-password.dto.js";
import type { LoginDto } from "./dto/login.dto.js";
import type { RegisterDto } from "./dto/register.dto.js";
import type { RequestPasswordResetDto } from "./dto/request-password-reset.dto.js";
import type { ResetPasswordDto } from "./dto/reset-password.dto.js";
import type { UpdateProfileDto } from "./dto/update-profile.dto.js";
import { PasswordResetMailerService } from "./password-reset-mailer.service.js";
import { authUserSelect, type AuthUserRecord } from "./auth-user-record.js";
import { PortfolioDemoWorkspaceService } from "./portfolio-demo-workspace.service.js";

const passwordResetAcknowledgement = {
  ok: true,
  message: "If an account exists for that email, a password reset link has been sent."
} as const satisfies PasswordResetRequestResponse;

export interface AuthClientContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly config = getApiEnv();
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordResetMailer: PasswordResetMailerService,
    private readonly portfolioDemoWorkspaces: PortfolioDemoWorkspaceService
  ) {}

  async register(input: RegisterDto, context: AuthClientContext = {}): Promise<AuthResponse> {
    this.assertStandardAuthEnabled();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() }
    });

    if (existingUser) {
      throw new ConflictException("An account already exists for this email.");
    }

    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: await hash(input.password, 12),
        ...(input.name ? { name: input.name } : {})
      }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "auth.registered",
        metadata: createSecurityActivityMetadata(user.email, context)
      }
    });

    return this.createAuthResponse(user, context);
  }

  async login(input: LoginDto, context: AuthClientContext = {}): Promise<AuthResponse> {
    this.assertStandardAuthEnabled();
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() }
    });

    if (!user || !(await compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "auth.logged_in",
        metadata: createSecurityActivityMetadata(user.email, context)
      }
    });

    return this.createAuthResponse(user, context);
  }

  async createPortfolioDemo(
    visitorToken: string,
    accessKey: string | undefined,
    context: AuthClientContext = {}
  ): Promise<AuthResponse> {
    this.assertPortfolioDemoAccess(accessKey);
    const user = await this.portfolioDemoWorkspaces.resolveWorkspace(visitorToken);

    await this.prisma.auditLog.create({
      data: {
        action: "auth.portfolio_demo_started",
        metadata: createSessionContext(context),
        userId: user.id
      }
    });

    return this.createAuthResponse(user, context);
  }

  async findCurrentUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: authUserSelect
    });

    return this.toAuthUser(user);
  }

  async updateProfile(userId: string, input: UpdateProfileDto): Promise<AuthUser> {
    const name = input.name.trim();

    if (!name) {
      throw new BadRequestException("Name cannot be blank.");
    }

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { name },
        select: authUserSelect
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: "auth.profile_updated",
          metadata: { fields: ["name"] }
        }
      })
    ]);

    return this.toAuthUser(updatedUser);
  }

  async changePassword(
    userId: string,
    sessionId: string,
    input: ChangePasswordDto
  ): Promise<ChangePasswordResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isPortfolioDemo: true,
        passwordHash: true
      }
    });

    if (user?.isPortfolioDemo) {
      throw new ForbiddenException("Password changes are unavailable in portfolio demo workspaces.");
    }

    if (!user || !(await compare(input.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException("Current password is incorrect.");
    }

    if (input.currentPassword === input.newPassword) {
      throw new BadRequestException("New password must be different from the current password.");
    }

    const passwordHash = await hash(input.newPassword, 12);
    const passwordChangedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordChangedAt, passwordHash }
      }),
      this.prisma.auditLog.create({
        data: {
          userId,
          action: "auth.password_changed"
        }
      }),
      this.prisma.authSession.updateMany({
        where: {
          userId,
          id: { not: sessionId },
          revokedAt: null
        },
        data: { revokedAt: passwordChangedAt }
      })
    ]);

    return { ok: true, passwordChangedAt: passwordChangedAt.toISOString() };
  }

  async logout(userId: string, sessionId: string) {
    const revokedAt = new Date();
    const result = await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null
      },
      data: { revokedAt }
    });

    if (result.count) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: "auth.logged_out",
          metadata: { sessionId }
        }
      });
    }

    return { ok: true } as const;
  }

  async requestPasswordReset(
    input: RequestPasswordResetDto
  ): Promise<PasswordResetRequestResponse> {
    this.assertStandardAuthEnabled();
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: { email: true, id: true }
    });

    if (!user) {
      return passwordResetAcknowledgement;
    }

    const now = new Date();
    const cooldownStartedAt = new Date(
      now.getTime() - this.config.PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS * 1_000
    );
    const recentRequest = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        createdAt: { gte: cooldownStartedAt }
      },
      select: { id: true }
    });

    if (recentRequest) {
      return passwordResetAcknowledgement;
    }

    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      now.getTime() + this.config.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60_000
    );
    const [, resetToken] = await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null
        },
        data: { usedAt: now }
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(rawToken),
          expiresAt
        },
        select: { id: true }
      })
    ]);
    const resetUrl = new URL("/", this.config.WEB_ORIGIN);
    resetUrl.searchParams.set("resetToken", rawToken);

    try {
      await this.passwordResetMailer.send({
        resetUrl: resetUrl.toString(),
        to: user.email
      });
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "auth.password_reset_requested"
        }
      });
    } catch (error) {
      await this.prisma.passwordResetToken.deleteMany({
        where: { id: resetToken.id }
      });
      this.logger.error(
        "Password reset delivery failed.",
        error instanceof Error ? error.stack : undefined
      );
    }

    return passwordResetAcknowledgement;
  }

  async resetPassword(input: ResetPasswordDto): Promise<ResetPasswordResponse> {
    this.assertStandardAuthEnabled();
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(input.token) },
      select: {
        expiresAt: true,
        id: true,
        usedAt: true,
        user: {
          select: {
            id: true,
            passwordHash: true
          }
        },
        userId: true
      }
    });
    const now = new Date();

    if (!token || token.usedAt || token.expiresAt <= now) {
      throw new BadRequestException("Password reset link is invalid or has expired.");
    }

    if (await compare(input.newPassword, token.user.passwordHash)) {
      throw new BadRequestException("New password must be different from the current password.");
    }

    const passwordHash = await hash(input.newPassword, 12);

    await this.prisma.$transaction(async (transaction) => {
      const claim = await transaction.passwordResetToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          expiresAt: { gt: now }
        },
        data: { usedAt: now }
      });

      if (claim.count !== 1) {
        throw new BadRequestException("Password reset link is invalid or has expired.");
      }

      await transaction.user.update({
        where: { id: token.userId },
        data: {
          passwordChangedAt: now,
          passwordHash
        }
      });
      await transaction.passwordResetToken.updateMany({
        where: {
          userId: token.userId,
          usedAt: null
        },
        data: { usedAt: now }
      });
      await transaction.authSession.updateMany({
        where: {
          userId: token.userId,
          revokedAt: null
        },
        data: { revokedAt: now }
      });
      await transaction.auditLog.create({
        data: {
          userId: token.userId,
          action: "auth.password_reset_completed"
        }
      });
    });

    return {
      ok: true,
      message: "Your password has been reset. Sign in with your new password."
    };
  }

  private async createAuthResponse(
    user: AuthUserRecord,
    context: AuthClientContext
  ): Promise<AuthResponse> {
    const standardExpiresAt = new Date(
      Date.now() + this.config.AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1_000
    );
    const expiresAt =
      user.isPortfolioDemo && user.portfolioDemoExpiresAt
        ? new Date(
            Math.min(standardExpiresAt.getTime(), user.portfolioDemoExpiresAt.getTime())
          )
        : standardExpiresAt;
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        expiresAt,
        ...createSessionContext(context)
      },
      select: { id: true }
    });
    const expiresIn = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1_000));
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        sid: session.id
      },
      { expiresIn }
    );

    return {
      accessToken,
      user: this.toAuthUser(user)
    };
  }

  private toAuthUser(user: AuthUserRecord): AuthUser {
    return {
      id: user.id,
      email: user.isPortfolioDemo
        ? this.config.PORTFOLIO_DEMO_TEMPLATE_EMAIL
        : user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      isPortfolioDemo: user.isPortfolioDemo,
      portfolioDemoExpiresAt: user.portfolioDemoExpiresAt?.toISOString() ?? null
    };
  }

  private assertStandardAuthEnabled() {
    if (this.config.PROOFPILOT_MODE === "portfolio") {
      throw new NotFoundException("Not found.");
    }
  }

  private assertPortfolioDemoAccess(accessKey: string | undefined) {
    const expectedAccessKey = this.config.PORTFOLIO_DEMO_ACCESS_KEY;

    if (
      this.config.PROOFPILOT_MODE !== "portfolio" ||
      !expectedAccessKey ||
      !constantTimeEquals(accessKey, expectedAccessKey)
    ) {
      throw new NotFoundException("Not found.");
    }
  }
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createSessionContext(context: AuthClientContext) {
  const ipAddress = sanitizeContextValue(context.ipAddress, 64);
  const userAgent = sanitizeContextValue(context.userAgent, 512);

  return {
    ...(ipAddress ? { ipAddress } : {}),
    ...(userAgent ? { userAgent } : {})
  };
}

function createSecurityActivityMetadata(email: string, context: AuthClientContext) {
  const sessionContext = createSessionContext(context);

  return {
    email,
    securityActivity: true,
    ...sessionContext
  };
}

function sanitizeContextValue(value: string | undefined, maxLength: number) {
  const normalized = value?.replace(/[\r\n]/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function constantTimeEquals(actual: string | undefined, expected: string) {
  if (!actual) {
    return false;
  }

  const actualDigest = createHash("sha256").update(actual).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}
