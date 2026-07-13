import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import type {
  AuthResponse,
  AuthUser,
  ChangePasswordResponse
} from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";
import type { ChangePasswordDto } from "./dto/change-password.dto.js";
import type { LoginDto } from "./dto/login.dto.js";
import type { RegisterDto } from "./dto/register.dto.js";
import type { UpdateProfileDto } from "./dto/update-profile.dto.js";

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true
} as const;

interface PublicUserRecord {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

export interface AuthClientContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(input: RegisterDto, context: AuthClientContext = {}): Promise<AuthResponse> {
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

    return this.createAuthResponse(user);
  }

  async login(input: LoginDto, context: AuthClientContext = {}): Promise<AuthResponse> {
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

    return this.createAuthResponse(user);
  }

  async findCurrentUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: publicUserSelect
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
        select: publicUserSelect
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
    input: ChangePasswordDto
  ): Promise<ChangePasswordResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true
      }
    });

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
      })
    ]);

    return { ok: true, passwordChangedAt: passwordChangedAt.toISOString() };
  }

  private async createAuthResponse(user: PublicUserRecord): Promise<AuthResponse> {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email
    });

    return {
      accessToken,
      user: this.toAuthUser(user)
    };
  }

  private toAuthUser(user: PublicUserRecord): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString()
    };
  }
}

function createSecurityActivityMetadata(email: string, context: AuthClientContext) {
  const ipAddress = sanitizeContextValue(context.ipAddress, 64);
  const userAgent = sanitizeContextValue(context.userAgent, 512);

  return {
    email,
    securityActivity: true,
    ...(ipAddress ? { ipAddress } : {}),
    ...(userAgent ? { userAgent } : {})
  };
}

function sanitizeContextValue(value: string | undefined, maxLength: number) {
  const normalized = value?.replace(/[\r\n]/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}
