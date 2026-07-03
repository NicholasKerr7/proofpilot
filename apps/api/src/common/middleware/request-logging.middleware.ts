import { Injectable, Logger, type NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger("RequestLogger");

  use(request: Request, response: Response, next: NextFunction) {
    const startedAt = process.hrtime.bigint();
    const requestId = getRequestId(request);

    response.setHeader("x-request-id", requestId);
    response.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      this.logger.log(
        JSON.stringify({
          durationMs: Math.round(durationMs),
          ip: request.ip ?? request.socket.remoteAddress ?? null,
          method: request.method,
          path: request.path ?? request.url.split("?")[0],
          requestId,
          statusCode: response.statusCode,
          userAgent: request.get("user-agent") ?? null
        })
      );
    });

    next();
  }
}

function getRequestId(request: Request) {
  const requestId = request.get("x-request-id");

  if (requestId && requestId.length <= 128) {
    return requestId;
  }

  return randomUUID();
}
