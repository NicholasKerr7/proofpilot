import {
  BriefcaseBusiness,
  CalendarCheck2,
  FileStack,
  Rocket,
  Send,
  ShieldCheck,
  type LucideIcon
} from "lucide-react";
import type { HelpCategoryId } from "@/components/app/help/help-content";

export const helpCategoryIcons: Record<HelpCategoryId, LucideIcon> = {
  "getting-started": Rocket,
  "cases-evidence": BriefcaseBusiness,
  "timeline-checklist": CalendarCheck2,
  "statements-packets": FileStack,
  "submission-review": Send,
  "account-security": ShieldCheck
};
