import {
  BadRequestException,
  Injectable,
  Param,
  type PipeTransform
} from "@nestjs/common";

export const resourceIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function isResourceId(value: unknown): value is string {
  return typeof value === "string" && resourceIdPattern.test(value);
}

@Injectable()
export class ResourceIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown) {
    if (!isResourceId(value)) {
      throw new BadRequestException(
        "Resource id must be 1 to 128 characters and contain only letters, numbers, underscores, or hyphens."
      );
    }

    return value;
  }
}

export function ResourceIdParam(name: string): ParameterDecorator {
  return Param(name, ResourceIdPipe);
}
