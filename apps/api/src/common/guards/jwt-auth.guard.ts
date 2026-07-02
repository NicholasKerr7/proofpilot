import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { RequestUser } from "../types/request-user.js";

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      const token = authHeader.slice("Bearer ".length);
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      request.user = {
        id: payload.sub,
        email: payload.email
      };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid bearer token");
    }
  }
}
