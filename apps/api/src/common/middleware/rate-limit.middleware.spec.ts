import type { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimitMiddleware } from "./rate-limit.middleware.js";

function createRequest(input: Partial<Request> = {}) {
  return {
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
  let middleware: RateLimitMiddleware;

  beforeEach(() => {
    vi.stubEnv("RATE_LIMIT_MAX", "2");
    vi.stubEnv("RATE_LIMIT_WINDOW_MS", "60000");
    middleware = new RateLimitMiddleware();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows requests until the bucket reaches its limit", () => {
    const request = createRequest();
    const firstNext: NextFunction = vi.fn();
    const secondNext: NextFunction = vi.fn();
    const thirdNext: NextFunction = vi.fn();
    const thirdResponse = createResponse();

    middleware.use(request, createResponse(), firstNext);
    middleware.use(request, createResponse(), secondNext);
    middleware.use(request, thirdResponse, thirdNext);

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

  it("does not throttle health checks", () => {
    const request = createRequest({ method: "GET", path: "/health", url: "/health" });
    const next: NextFunction = vi.fn();

    middleware.use(request, createResponse(), next);
    middleware.use(request, createResponse(), next);
    middleware.use(request, createResponse(), next);

    expect(next).toHaveBeenCalledTimes(3);
  });
});
