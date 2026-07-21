import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  ShieldCheck
} from "lucide-react";
import { CaseProgressRing } from "@/components/app/cases/case-progress-ring";
import {
  formatCaseDate,
  formatCaseReference,
  formatCaseStatus,
  getCaseReadiness,
  getCaseStatusVariant
} from "@/components/app/cases/case-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CaseRecord } from "@/lib/client/types";

interface CollaborationCaseHeroProps {
  caseRecord: CaseRecord;
  onBack: () => void;
}

export function CollaborationCaseHero({ caseRecord, onBack }: CollaborationCaseHeroProps) {
  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-2 md:items-center">
        <Button
          aria-label="Back to case"
          className="-ml-2 shrink-0"
          onClick={onBack}
          size="icon"
          title="Back to case"
          type="button"
          variant="ghost"
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold sm:text-3xl" id="case-collaboration-heading">
            <span className="md:hidden">Case sharing</span>
            <span className="hidden md:inline">Case sharing / collaborators</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage collaborators, invitations, and case sharing controls.
          </p>
        </div>
      </div>

      <Card className="proof-accent-frame">
        <CardContent className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase text-primary">
              <BriefcaseBusiness aria-hidden="true" className="h-5 w-5" />
              Current case
            </div>
            <h2 className="mt-3 break-words text-xl font-semibold leading-7 md:text-2xl">
              {caseRecord.title}
            </h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {formatCaseReference(caseRecord)}
            </p>
            <dl className="mt-4 grid gap-3 border-t border-border pt-4 min-[360px]:grid-cols-2">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                <CalendarDays aria-hidden="true" className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <dt className="text-xs text-muted-foreground">Deadline</dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">
                    {caseRecord.deadline ? formatCaseDate(caseRecord.deadline) : "Not set"}
                  </dd>
                </div>
              </div>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd className="mt-1">
                    <Badge variant={getCaseStatusVariant(caseRecord.status)}>
                      {formatCaseStatus(caseRecord.status)}
                    </Badge>
                  </dd>
                </div>
              </div>
            </dl>
          </div>

          <CaseProgressRing
            className="hidden md:grid"
            label="Case progress"
            value={getCaseReadiness(caseRecord)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
