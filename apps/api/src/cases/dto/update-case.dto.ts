import { PartialType } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { CaseStatus } from "@proofpilot/database";
import { CreateCaseDto } from "./create-case.dto.js";

export class UpdateCaseDto extends PartialType(CreateCaseDto) {
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;
}
