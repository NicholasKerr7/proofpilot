import { ArgumentsHost, BadRequestException } from "@nestjs/common";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrorMonitoringService } from "../../monitoring/error-monitoring.service.js";
import { HttpExceptionFilter } from "./http-exception.filter.js";

type MonitoringMock = ReturnType<typeof createMonitoringMock>;

function createMonitoringMock() {
  return {
    captureException: vi.fn().mockResolvedValue(undefined)
  };
}

function createRequest() {
  return {
    get: vi.fn().mockReturnValue(undefined),
    method: "GET",
    path: "/cases",
    url: "/cases"
  } as unknown as Request;
}

function createResponse() {
  return {
    getHeader: vi.fn().mockReturnValue("request-1"),
    headersSent: false,
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis()
  } as unknown as Response;
}

function createHost(request: Request, response: Response) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response
    })
  } as ArgumentsHost;
}

describe("HttpExceptionFilter", () => {
  let monitoring: MonitoringMock;
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    monitoring = createMonitoringMock();
    filter = new HttpExceptionFilter(monitoring as unknown as ErrorMonitoringService);
  });

  it("captures unhandled errors and returns a sanitized 500 response", () => {
    const request = createRequest();
    const response = createResponse();
    const error = new Error("database password leaked in stack");

    filter.catch(error, createHost(request, response));

    expect(monitoring.captureException).toHaveBeenCalledWith(error, {
      method: "GET",
      path: "/cases",
      requestId: "request-1",
      statusCode: 500
    });
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Internal Server Error",
        message: "Internal server error",
        path: "/cases",
        requestId: "request-1",
        statusCode: 500
      })
    );
  });

  it("does not capture expected client errors", () => {
    const request = createRequest();
    const response = createResponse();

    filter.catch(new BadRequestException("Invalid input."), createHost(request, response));

    expect(monitoring.captureException).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Invalid input.",
        requestId: "request-1",
        statusCode: 400
      })
    );
  });
});
