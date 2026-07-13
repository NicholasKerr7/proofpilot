import { IsIn, IsString } from "class-validator";
import {
  billingPortalSectionOptions,
  type BillingPortalSection
} from "@proofpilot/types";

export class CreateBillingPortalDto {
  @IsString()
  @IsIn(billingPortalSectionOptions)
  section!: BillingPortalSection;
}
