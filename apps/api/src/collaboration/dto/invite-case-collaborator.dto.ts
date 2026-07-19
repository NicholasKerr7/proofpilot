import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, MaxLength } from "class-validator";
import {
  caseCollaboratorRoles,
  type CaseCollaboratorRole
} from "@proofpilot/types";

export class InviteCaseCollaboratorDto {
  @ApiProperty({ example: "advisor@example.com" })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ enum: caseCollaboratorRoles, example: "VIEWER" })
  @IsIn(caseCollaboratorRoles)
  role!: CaseCollaboratorRole;
}
