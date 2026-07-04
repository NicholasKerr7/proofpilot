import { Injectable, Logger } from "@nestjs/common";
import { getApiEnv } from "../config/env.js";

export interface ErrorMonitoringContext {
  method: string;
  path: string;
  requestId: string;
  statusCode: number;
}

interface ErrorMonitoringEvent extends ErrorMonitoringContext {
  environment: string;
  errorMessage: string;
  errorName: string;
  occurredAt: string;
  service: "proofpilot-api";
  stack?: string;
}

@Injectable()
export class ErrorMonitoringService {
  private readonly env = getApiEnv();
  private readonly logger = new Logger("ErrorMonitoring");

  async captureException(error: unknown, context: ErrorMonitoringContext) {
    const event = this.createEvent(error, context);

    this.logger.error(JSON.stringify(event), event.stack);

    if (!this.env.ERROR_MONITORING_WEBHOOK_URL) {
      return;
    }

    try {
      const response = await fetch(this.env.ERROR_MONITORING_WEBHOOK_URL, {
        body: JSON.stringify(event),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });

      if (!response.ok) {
        this.logger.error(
          JSON.stringify({
            message: "Error monitoring webhook returned a non-2xx response.",
            requestId: context.requestId,
            statusCode: response.status
          })
        );
      }
    } catch (webhookError) {
      this.logger.error(
        JSON.stringify({
          message: "Error monitoring webhook request failed.",
          requestId: context.requestId
        }),
        webhookError instanceof Error ? webhookError.stack : undefined
      );
    }
  }

  private createEvent(error: unknown, context: ErrorMonitoringContext): ErrorMonitoringEvent {
    const event: ErrorMonitoringEvent = {
      ...context,
      environment: this.env.ERROR_MONITORING_ENVIRONMENT,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorName: error instanceof Error ? error.name : "UnknownError",
      occurredAt: new Date().toISOString(),
      service: "proofpilot-api"
    };

    if (error instanceof Error && error.stack) {
      event.stack = error.stack;
    }

    return event;
  }
}
