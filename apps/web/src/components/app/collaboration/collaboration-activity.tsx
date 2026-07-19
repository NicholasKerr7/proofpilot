import {
  Settings2,
  ShieldCheck,
  UserMinus,
  UserPlus,
  type LucideIcon
} from "lucide-react";
import type {
  CaseCollaborationActivityAction,
  CaseCollaborationActivityRecord
} from "@proofpilot/types";
import {
  formatCollaborationDate,
  getCollaborationActivityLabel
} from "@/components/app/collaboration/collaboration-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const activityIcons: Record<CaseCollaborationActivityAction, LucideIcon> = {
  INVITED: UserPlus,
  ROLE_UPDATED: ShieldCheck,
  REMOVED: UserMinus,
  SETTINGS_UPDATED: Settings2
};

interface CollaborationActivityProps {
  activity: CaseCollaborationActivityRecord[];
}

export function CollaborationActivity({ activity }: CollaborationActivityProps) {
  return (
    <Card className="scroll-mt-28" id="collaboration-activity">
      <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center p-4 pb-3">
        <CardTitle className="text-sm uppercase text-primary">Activity summary</CardTitle>
        <span className="text-xs text-muted-foreground">
          {activity.length} {activity.length === 1 ? "event" : "events"}
        </span>
      </CardHeader>
      <CardContent className="p-0">
        {activity.length ? (
          <div className="divide-y divide-border border-t border-border">
            {activity.map((item) => {
              const Icon = activityIcons[item.action];

              return (
                <div
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center"
                  key={item.id}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {getCollaborationActivityLabel(item.action)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {item.actorName} - {item.detail}
                    </p>
                  </div>
                  <time
                    className="col-start-2 text-xs text-muted-foreground md:col-start-3"
                    dateTime={item.createdAt}
                  >
                    {formatCollaborationDate(item.createdAt)}
                  </time>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Collaboration changes will appear here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
