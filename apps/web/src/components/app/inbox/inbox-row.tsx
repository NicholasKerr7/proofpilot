import type {
  InboxConversationCategory,
  InboxConversationRecord
} from "@proofpilot/types";
import {
  Bell,
  BriefcaseBusiness,
  Headphones,
  UsersRound
} from "lucide-react";
import {
  formatInboxListDate,
  getInboxCategoryLabel,
  getInboxCategoryVariant
} from "@/components/app/inbox/inbox-utils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface InboxRowProps {
  active: boolean;
  conversation: InboxConversationRecord;
  onOpen: (conversation: InboxConversationRecord) => void;
}

export function InboxRow({ active, conversation, onOpen }: InboxRowProps) {
  return (
    <button
      aria-current={active ? "true" : undefined}
      aria-label={`Open ${conversation.participantName}: ${conversation.subject}`}
      className={cn(
        "relative grid min-h-32 w-full grid-cols-[3rem_minmax(0,1fr)] gap-3 border-b border-border px-3 py-4 text-left transition-colors last:border-b-0 hover:bg-secondary/25 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-primary/10 ring-1 ring-inset ring-primary/55" : null
      )}
      onClick={() => onOpen(conversation)}
      type="button"
    >
      {!conversation.readAt ? (
        <span
          aria-label="Unread"
          className="absolute left-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_rgba(244,108,38,0.55)]"
        />
      ) : null}

      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-primary">
        {renderCategoryIcon(conversation.category)}
      </span>

      <span className="min-w-0">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0 truncate text-sm font-semibold text-foreground">
            {conversation.participantName}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatInboxListDate(conversation.updatedAt)}
          </span>
        </span>
        <span className="mt-2 block truncate text-sm text-foreground/90">
          {conversation.subject}
        </span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {conversation.preview}
        </span>
        <span className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={getInboxCategoryVariant(conversation.category)}>
            {getInboxCategoryLabel(conversation.category)}
          </Badge>
          {conversation.case ? (
            <span className="truncate text-[11px] text-muted-foreground">
              {conversation.case.platform}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function renderCategoryIcon(category: InboxConversationCategory) {
  if (category === "SUPPORT") {
    return <Headphones className="h-5 w-5" aria-hidden="true" />;
  }

  if (category === "TEAM") {
    return <UsersRound className="h-5 w-5" aria-hidden="true" />;
  }

  if (category === "CASE_UPDATE") {
    return <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />;
  }

  return <Bell className="h-5 w-5" aria-hidden="true" />;
}
