"use client";

import {
  CheckCheck,
  Inbox,
  LoaderCircle,
  MailPlus,
  Search,
  X
} from "lucide-react";
import { InboxComposer } from "@/components/app/inbox/inbox-composer";
import { InboxDetail } from "@/components/app/inbox/inbox-detail";
import { InboxRow } from "@/components/app/inbox/inbox-row";
import {
  getInboxConversationKey,
  inboxCategoryOptions,
  type InboxSort
} from "@/components/app/inbox/inbox-utils";
import { useInboxPanel } from "@/components/app/inbox/use-inbox-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CaseRecord } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface InboxPanelProps {
  cases: CaseRecord[];
  onNotificationsChanged: () => void;
  onOpenCase: (caseId: string) => void;
  onUnreadCountChange: (count: number) => void;
  ownerName: string;
  refreshKey: number;
  selectedCaseId: string | null;
}

/** Renders inbox list, composer, and conversation detail around the inbox controller. */
export function InboxPanel({
  cases,
  onNotificationsChanged,
  onOpenCase,
  onUnreadCountChange,
  ownerName,
  refreshKey,
  selectedCaseId
}: InboxPanelProps) {
  const inbox = useInboxPanel({
    onNotificationsChanged,
    onUnreadCountChange,
    refreshKey
  });
  const showMobileWorkspace = inbox.isComposing || inbox.isMobileDetailOpen;

  return (
    <section aria-labelledby="inbox-heading" className="grid gap-4">
      <header
        className={cn(
          "proof-page-header flex flex-wrap items-end justify-between gap-4",
          showMobileWorkspace ? "hidden md:flex" : null
        )}
      >
        <div>
          <p className="text-sm font-semibold text-primary">Case communication</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl" id="inbox-heading">
            Inbox
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Messages and updates connected to your cases.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!inbox.unreadCount || inbox.updatingKey === "all"}
            onClick={() => {
              void inbox.markAllRead();
            }}
            type="button"
            variant="outline"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark all read
          </Button>
          <Button
            onClick={() => {
              inbox.setIsComposing(true);
              inbox.setIsMobileDetailOpen(false);
              inbox.setNotice(null);
            }}
            type="button"
          >
            <MailPlus className="h-4 w-4" aria-hidden="true" />
            New message
          </Button>
        </div>
      </header>

      {inbox.notice ? (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            inbox.notice.tone === "success"
              ? "border-teal-400/30 bg-teal-400/10 text-teal-100"
              : "border-red-400/30 bg-red-400/10 text-red-100"
          )}
          role={inbox.notice.tone === "error" ? "alert" : "status"}
        >
          {inbox.notice.text}
        </p>
      ) : null}

      {inbox.isComposing ? (
        <InboxComposer
          cases={cases}
          initialCaseId={selectedCaseId}
          onCancel={() => inbox.setIsComposing(false)}
          onCreated={inbox.handleCreated}
        />
      ) : (
        <>
          <div
            className={cn(
              "grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center",
              inbox.isMobileDetailOpen ? "hidden md:grid" : null
            )}
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                aria-label="Search messages"
                className="pl-11 pr-12"
                onChange={(event) => inbox.setSearchQuery(event.target.value)}
                placeholder="Search messages"
                type="search"
                value={inbox.searchQuery}
              />
              {inbox.searchQuery ? (
                <Button
                  aria-label="Clear message search"
                  className="absolute right-0 top-1/2 -translate-y-1/2"
                  onClick={() => inbox.setSearchQuery("")}
                  size="icon"
                  title="Clear message search"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
            <Select
              aria-label="Sort conversations"
              className="md:w-44"
              onChange={(event) => inbox.setSort(event.target.value as InboxSort)}
              value={inbox.sort}
            >
              <option value="NEWEST">Sort: Newest</option>
              <option value="OLDEST">Sort: Oldest</option>
            </Select>
          </div>

          <div
            aria-label="Filter messages"
            className={cn(
              "flex gap-1 overflow-x-auto border border-border bg-card p-1 scroll-container",
              inbox.isMobileDetailOpen ? "hidden md:flex" : null
            )}
            role="group"
          >
            <InboxFilterButton
              active={inbox.filter === "ALL"}
              count={inbox.conversations.length}
              label="All"
              onClick={() => inbox.setFilter("ALL")}
            />
            <InboxFilterButton
              active={inbox.filter === "UNREAD"}
              count={inbox.unreadCount}
              label="Unread"
              onClick={() => inbox.setFilter("UNREAD")}
            />
            {inboxCategoryOptions.map((option) => (
              <InboxFilterButton
                active={inbox.filter === option.value}
                count={
                  inbox.conversations.filter(
                    (conversation) => conversation.category === option.value
                  ).length
                }
                key={option.value}
                label={option.label}
                onClick={() => inbox.setFilter(option.value)}
              />
            ))}
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(16rem,0.78fr)_minmax(0,1.22fr)] md:items-start xl:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)]">
            <section
              aria-labelledby="conversation-list-heading"
              className={cn(
                "min-w-0 overflow-hidden border border-border bg-card",
                inbox.isMobileDetailOpen ? "hidden md:block" : null
              )}
            >
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold" id="conversation-list-heading">
                    Conversations
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {inbox.filteredConversations.length} shown
                  </p>
                </div>
                <Badge variant={inbox.unreadCount ? "default" : "secondary"}>
                  {inbox.unreadCount} unread
                </Badge>
              </div>

              {inbox.isLoading ? (
                <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                  Loading conversations
                </div>
              ) : inbox.filteredConversations.length ? (
                <div className="scroll-container md:max-h-[48rem] md:overflow-y-auto">
                  {inbox.filteredConversations.map((conversation) => (
                    <InboxRow
                      active={
                        getInboxConversationKey(conversation) === inbox.selectedKey
                      }
                      conversation={conversation}
                      key={getInboxConversationKey(conversation)}
                      onOpen={(selectedConversation) => {
                        void inbox.openConversation(selectedConversation);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid min-h-48 place-items-center px-6 py-10 text-center">
                  <div>
                    <Inbox className="mx-auto h-7 w-7 text-primary" aria-hidden="true" />
                    <h3 className="mt-3 text-sm font-semibold">No conversations found</h3>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      Try another search or message filter.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <div className={cn(inbox.isMobileDetailOpen ? "block" : "hidden md:block")}>
              <InboxDetail
                conversation={inbox.detail}
                isLoading={inbox.isDetailLoading}
                isUpdating={
                  inbox.detail
                    ? inbox.updatingKey === getInboxConversationKey(inbox.detail)
                    : false
                }
                key={
                  inbox.detail
                    ? getInboxConversationKey(inbox.detail)
                    : "empty-conversation"
                }
                onBack={() => inbox.setIsMobileDetailOpen(false)}
                onMarkUnread={inbox.markUnread}
                onOpenCase={onOpenCase}
                onReply={inbox.reply}
                ownerName={ownerName}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/** Renders one inbox category segment with its current count. */
function InboxFilterButton({
  active,
  count,
  label,
  onClick
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-pressed={active}
      className="shrink-0"
      onClick={onClick}
      size="sm"
      type="button"
      variant={active ? "secondary" : "ghost"}
    >
      {label}
      <span className="rounded-sm border border-border bg-background/35 px-1.5 py-0.5 text-[10px]">
        {count}
      </span>
    </Button>
  );
}
