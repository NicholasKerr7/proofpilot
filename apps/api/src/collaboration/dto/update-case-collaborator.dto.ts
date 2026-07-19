import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import {
  caseCollaboratorRoles,
  type CaseCollaboratorRole
} from "@proofpilot/types";

export class UpdateCaseCollaboratorDto {
  @ApiProperty({ enum: caseCollaboratorRoles, example: "EDITOR" })
  @IsIn(caseCollaboratorRoles)
  role!: CaseCollaboratorRole;
}
