import { Injectable, type NestMiddleware } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getRateLimitEnv } from "../../config/env.js";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly config = getRateLimitEnv();
  private readonly buckets = new Map<string, RateLimitBucket>();
  private lastCleanupAt = 0;

  constructor(private readonly jwtService: JwtService) {}

  async use(request: Request, response: Response, next: NextFunction) {
    if (isRateLimitBypassed(request)) {
      next();
      return;
    }

    const now = Date.now();
    this.cleanupExpiredBuckets(now);

    const key = await this.getBucketKey(request);
    const bucket = this.getBucket(key, now);

    if (bucket.count >= this.config.RATE_LIMIT_MAX) {
      this.setHeaders(response, bucket, 0);
      response.status(429).json({
        error: "Too Many Requests",
        message: "Too many requests. Try again shortly.",
        statusCode: 429
      });
      return;
    }

    bucket.count += 1;
    this.setHeaders(response, bucket, this.config.RATE_LIMIT_MAX - bucket.count);
    next();
  }

  private async getBucketKey(request: Request) {
    const authorization = request.headers.authorization;

    if (
      typeof authorization === "string" &&
      authorization.startsWith("Bearer ") &&
      authorization.length <= 8_192
    ) {
      try {
        const payload = await this.jwtService.verifyAsync<{ sid?: unknown }>(
          authorization.slice("Bearer ".length)
        );

        if (typeof payload.sid === "string" && payload.sid.length > 0) {
          const sessionHash = createHash("sha256").update(payload.sid).digest("hex");
          return `session:${sessionHash}`;
        }
      } catch {
        // Invalid bearer values remain subject to the unauthenticated IP bucket.
      }
    }

    return `ip:${request.ip ?? request.socket.remoteAddress ?? "unknown"}`;
  }

  private getBucket(key: string, now: number) {
    const existingBucket = this.buckets.get(key);

    if (existingBucket && existingBucket.resetAt > now) {
      return existingBucket;
    }

    const bucket = {
      count: 0,
      resetAt: now + this.config.RATE_LIMIT_WINDOW_MS
    };
    this.buckets.set(key, bucket);

    return bucket;
  }

  private cleanupExpiredBuckets(now: number) {
    if (now - this.lastCleanupAt < this.config.RATE_LIMIT_WINDOW_MS) {
      return;
    }

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }

    this.lastCleanupAt = now;
  }

  private setHeaders(response: Response, bucket: RateLimitBucket, remaining: number) {
    response.setHeader("RateLimit-Limit", String(this.config.RATE_LIMIT_MAX));
    response.setHeader("RateLimit-Remaining", String(Math.max(0, remaining)));
    response.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
  }
}

function isRateLimitBypassed(request: Request) {
  const path = (request.originalUrl || request.url || request.path).split("?")[0];
  return path === "/health" || path === "/health/ready" || path === "/health/queues";
}
