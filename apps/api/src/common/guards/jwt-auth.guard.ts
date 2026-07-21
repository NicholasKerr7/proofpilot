import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { RequestUser } from "../types/request-user.js";

interface JwtPayload {
  sub: string;
  email: string;
  sid: string;
}

const lastSeenWriteIntervalMs = 5 * 60 * 1_000;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = authHeader.slice("Bearer ".length);
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException("Invalid bearer token");
    }

    if (!payload.sub || !payload.sid) {
      throw new UnauthorizedException("Invalid bearer token");
    }

    const now = new Date();
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: now }
      },
      select: {
        id: true,
        lastSeenAt: true,
        user: {
          select: { email: true }
        }
      }
    });

    if (!session) {
      throw new UnauthorizedException("Session has expired or was revoked");
    }

    if (session.lastSeenAt.getTime() <= now.getTime() - lastSeenWriteIntervalMs) {
      await this.prisma.authSession.updateMany({
        where: {
          id: session.id,
          userId: payload.sub,
          revokedAt: null
        },
        data: { lastSeenAt: now }
      });
    }

    request.user = {
      id: payload.sub,
      email: session.user.email,
      sessionId: session.id
    };
    return true;
  }
}
