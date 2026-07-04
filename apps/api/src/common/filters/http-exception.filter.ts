import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ErrorMonitoringService } from "../../monitoring/error-monitoring.service.js";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly errorMonitoring: ErrorMonitoringService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode = getStatusCode(exception);
    const requestId = getRequestId(request, response);
    const path = request.path ?? request.url.split("?")[0];

    if (statusCode >= 500) {
      void this.errorMonitoring.captureException(exception, {
        method: request.method,
        path,
        requestId,
        statusCode
      });
    }

    if (response.headersSent) {
      return;
    }

    response.status(statusCode).json({
      ...getResponseBody(exception),
      path,
      requestId,
      statusCode,
      timestamp: new Date().toISOString()
    });
  }
}

function getStatusCode(exception: unknown) {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }

  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function getRequestId(request: Request, response: Response) {
  const responseRequestId = response.getHeader("x-request-id");

  if (typeof responseRequestId === "string") {
    return responseRequestId;
  }

  const requestRequestId = request.get("x-request-id");

  if (requestRequestId && requestRequestId.length <= 128) {
    return requestRequestId;
  }

  return "unknown";
}

function getResponseBody(exception: unknown) {
  if (!(exception instanceof HttpException)) {
    return {
      error: "Internal Server Error",
      message: "Internal server error"
    };
  }

  const response = exception.getResponse();

  if (typeof response === "string") {
    return {
      error: exception.name,
      message: response
    };
  }

  if (response && typeof response === "object") {
    return response as Record<string, unknown>;
  }

  return {
    error: "Error",
    message: exception.message
  };
}
