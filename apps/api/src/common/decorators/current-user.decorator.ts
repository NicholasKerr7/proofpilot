import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { RequestUser } from "../types/request-user.js";

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<Request & { user: RequestUser }>();
  return request.user;
});
