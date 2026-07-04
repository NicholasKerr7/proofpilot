import { Injectable, type NestMiddleware } from "@nestjs/common";
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

  use(request: Request, response: Response, next: NextFunction) {
    if (isRateLimitBypassed(request)) {
      next();
      return;
    }

    const now = Date.now();
    this.cleanupExpiredBuckets(now);

    const key = this.getBucketKey(request);
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

  private getBucketKey(request: Request) {
    return request.ip ?? request.socket.remoteAddress ?? "unknown";
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
  const path = request.path ?? request.url.split("?")[0] ?? "";
  return path === "/health" || path === "/health/queues";
}
