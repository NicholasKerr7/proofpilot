import type { NextFunction, Request, Response } from "express";
import type { JwtService } from "@nestjs/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimitMiddleware } from "./rate-limit.middleware.js";

function createRequest(input: Partial<Request> = {}) {
  return {
    headers: {},
    ip: "127.0.0.1",
    method: "POST",
    path: "/auth/login",
    socket: {
      remoteAddress: "127.0.0.1"
    },
    url: "/auth/login",
    ...input
  } as Request;
}

function createResponse() {
  return {
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis()
  } as unknown as Response;
}

describe("RateLimitMiddleware", () => {
  let jwtService: { verifyAsync: ReturnType<typeof vi.fn> };
  let middleware: RateLimitMiddleware;

  beforeEach(() => {
    vi.stubEnv("RATE_LIMIT_MAX", "2");
    vi.stubEnv("RATE_LIMIT_WINDOW_MS", "60000");
    jwtService = {
      verifyAsync: vi.fn(async (token: string) => {
        if (token === "session-token-one") {
          return { sid: "session-one" };
        }

        if (token === "session-token-two") {
          return { sid: "session-two" };
        }

        throw new Error("Invalid token");
      })
    };
    middleware = new RateLimitMiddleware(jwtService as unknown as JwtService);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows requests until the bucket reaches its limit", async () => {
    const request = createRequest();
    const firstNext: NextFunction = vi.fn();
    const secondNext: NextFunction = vi.fn();
    const thirdNext: NextFunction = vi.fn();
    const thirdResponse = createResponse();

    await middleware.use(request, createResponse(), firstNext);
    await middleware.use(request, createResponse(), secondNext);
    await middleware.use(request, thirdResponse, thirdNext);

    expect(firstNext).toHaveBeenCalledTimes(1);
    expect(secondNext).toHaveBeenCalledTimes(1);
    expect(thirdNext).not.toHaveBeenCalled();
    expect(thirdResponse.status).toHaveBeenCalledWith(429);
    expect(thirdResponse.json).toHaveBeenCalledWith({
      error: "Too Many Requests",
      message: "Too many requests. Try again shortly.",
      statusCode: 429
    });
  });

  it("does not throttle health checks", async () => {
    for (const path of ["/health", "/health/ready", "/health/queues"]) {
      const request = createRequest({
        method: "GET",
        originalUrl: `${path}?probe=readiness`,
        path: "/",
        url: "/"
      });
      const next: NextFunction = vi.fn();

      await middleware.use(request, createResponse(), next);
      await middleware.use(request, createResponse(), next);
      await middleware.use(request, createResponse(), next);

      expect(next).toHaveBeenCalledTimes(3);
    }
  });

  it("isolates authenticated sessions behind the same proxy address", async () => {
    const firstSession = createRequest({
      headers: { authorization: "Bearer session-token-one" }
    });
    const secondSession = createRequest({
      headers: { authorization: "Bearer session-token-two" }
    });
    const firstSessionNext: NextFunction = vi.fn();
    const secondSessionNext: NextFunction = vi.fn();
    const blockedNext: NextFunction = vi.fn();
    const blockedResponse = createResponse();

    await middleware.use(firstSession, createResponse(), firstSessionNext);
    await middleware.use(firstSession, createResponse(), firstSessionNext);
    await middleware.use(secondSession, createResponse(), secondSessionNext);
    await middleware.use(firstSession, blockedResponse, blockedNext);

    expect(firstSessionNext).toHaveBeenCalledTimes(2);
    expect(secondSessionNext).toHaveBeenCalledTimes(1);
    expect(blockedNext).not.toHaveBeenCalled();
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
  });

  it("does not let invalid bearer values escape the IP bucket", async () => {
    const firstNext: NextFunction = vi.fn();
    const secondNext: NextFunction = vi.fn();
    const blockedNext: NextFunction = vi.fn();
    const blockedResponse = createResponse();

    await middleware.use(
      createRequest({ headers: { authorization: "Bearer fake-token-one" } }),
      createResponse(),
      firstNext
    );
    await middleware.use(
      createRequest({ headers: { authorization: "Bearer fake-token-two" } }),
      createResponse(),
      secondNext
    );
    await middleware.use(
      createRequest({ headers: { authorization: "Bearer fake-token-three" } }),
      blockedResponse,
      blockedNext
    );

    expect(firstNext).toHaveBeenCalledTimes(1);
    expect(secondNext).toHaveBeenCalledTimes(1);
    expect(blockedNext).not.toHaveBeenCalled();
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
  });
});
