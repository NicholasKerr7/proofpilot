import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import type { AuthResponse } from "@proofpilot/types";
import { PrismaService } from "../prisma/prisma.service.js";
import type { LoginDto } from "./dto/login.dto.js";
import type { RegisterDto } from "./dto/register.dto.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(input: RegisterDto): Promise<AuthResponse> {
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
        metadata: { email: user.email }
      }
    });

    return this.createAuthResponse(user);
  }

  async login(input: LoginDto): Promise<AuthResponse> {
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
        metadata: { email: user.email }
      }
    });

    return this.createAuthResponse(user);
  }

  async findCurrentUser(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });
  }

  private async createAuthResponse(user: { id: string; email: string; name: string | null }) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }
}
