"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  InboxConversationDetail,
  InboxConversationRecord,
  InboxMessageRecord,
  InboxReadStateRecord,
  SupportRequestMessageRecord,
  SupportRequestRecord
} from "@proofpilot/types";
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
  matchesInboxFilter,
  matchesInboxSearch,
  sortInboxConversations,
  type InboxFilter,
  type InboxSort
} from "@/components/app/inbox/inbox-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiRequest } from "@/lib/client/api";
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

type Notice = {
  text: string;
  tone: "error" | "success";
};

export function InboxPanel({
  cases,
  onNotificationsChanged,
  onOpenCase,
  onUnreadCountChange,
  ownerName,
  refreshKey,
  selectedCaseId
}: InboxPanelProps) {
  const [conversations, setConversations] = useState<InboxConversationRecord[]>([]);
  const [filter, setFilter] = useState<InboxFilter>("ALL");
  const [sort, setSort] = useState<InboxSort>("NEWEST");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<InboxConversationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const unreadCount = conversations.filter((conversation) => !conversation.readAt).length;
  const filteredConversations = useMemo(
    () =>
      sortInboxConversations(
        conversations.filter(
          (conversation) =>
            matchesInboxFilter(conversation, filter) &&
            matchesInboxSearch(conversation, searchQuery)
        ),
        sort
      ),
    [conversations, filter, searchQuery, sort]
  );
  const selectedConversation =
    filteredConversations.find(
      (conversation) => getInboxConversationKey(conversation) === selectedKey
    ) ?? null;
  const selectedSource = selectedConversation?.source ?? null;
  const selectedId = selectedConversation?.id ?? null;

  useEffect(() => {
    onUnreadCountChange(unreadCount);
  }, [onUnreadCountChange, unreadCount]);

  useEffect(() => {
    let isMounted = true;

    async function loadConversations() {
      setIsLoading(true);
      setNotice(null);

      try {
        const nextConversations = await apiRequest<InboxConversationRecord[]>(
          "/api/inbox/conversations"
        );

        if (!isMounted) {
          return;
        }

        setConversations(nextConversations);
        setSelectedKey((currentKey) => {
          if (
            currentKey &&
            nextConversations.some(
              (conversation) => getInboxConversationKey(conversation) === currentKey
            )
          ) {
            return currentKey;
          }

          return window.matchMedia("(min-width: 768px)").matches && nextConversations[0]
            ? getInboxConversationKey(nextConversations[0])
            : null;
        });
      } catch (error) {
        if (isMounted) {
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Inbox could not be loaded."
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadConversations();

    return () => {
      isMounted = false;
    };
  }, [refreshKey, reloadKey]);

  useEffect(() => {
    if (!selectedSource || !selectedId) {
      return;
    }

    let isMounted = true;

    async function loadDetail() {
      setIsDetailLoading(true);

      try {
        const nextDetail = await apiRequest<InboxConversationDetail>(
          `/api/inbox/conversations/${selectedSource}/${selectedId}`
        );

        if (isMounted) {
          setDetail(nextDetail);
        }
      } catch (error) {
        if (isMounted) {
          setDetail(null);
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Conversation could not be loaded."
          });
        }
      } finally {
        if (isMounted) {
          setIsDetailLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      isMounted = false;
    };
  }, [refreshKey, reloadKey, selectedId, selectedSource]);

  async function updateReadState(conversation: InboxConversationRecord, read: boolean) {
    const conversationKey = getInboxConversationKey(conversation);
    setUpdatingKey(conversationKey);

    try {
      const result = await apiRequest<InboxReadStateRecord>(
        `/api/inbox/conversations/${conversation.source}/${conversation.id}/read`,
        {
          body: JSON.stringify({ read }),
          method: "PATCH"
        }
      );
      setConversations((currentConversations) =>
        currentConversations.map((currentConversation) =>
          getInboxConversationKey(currentConversation) === conversationKey
            ? { ...currentConversation, readAt: result.readAt }
            : currentConversation
        )
      );
      setDetail((currentDetail) =>
        currentDetail && getInboxConversationKey(currentDetail) === conversationKey
          ? { ...currentDetail, readAt: result.readAt }
          : currentDetail
      );

      if (conversation.source === "NOTIFICATION") {
        onNotificationsChanged();
      }
    } finally {
      setUpdatingKey(null);
    }
  }

  async function handleOpenConversation(conversation: InboxConversationRecord) {
    setIsComposing(false);
    setSelectedKey(getInboxConversationKey(conversation));
    setIsMobileDetailOpen(true);
    setNotice(null);

    if (!conversation.readAt) {
      try {
        await updateReadState(conversation, true);
      } catch (error) {
        setNotice({
          tone: "error",
          text: error instanceof Error ? error.message : "Conversation could not be marked read."
        });
      }
    }
  }

  async function handleMarkUnread(conversation: InboxConversationDetail) {
    setNotice(null);

    try {
      await updateReadState(conversation, false);
      setNotice({ tone: "success", text: "Conversation marked unread." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Conversation could not be updated."
      });
    }
  }

  async function handleMarkAllRead() {
    if (!unreadCount) {
      return;
    }

    setUpdatingKey("all");
    setNotice(null);

    try {
      const result = await apiRequest<{ readAt: string; updatedCount: number }>(
        "/api/inbox/read-all",
        { method: "PATCH" }
      );
      setConversations((currentConversations) =>
        currentConversations.map((conversation) => ({
          ...conversation,
          readAt: conversation.readAt ?? result.readAt
        }))
      );
      setDetail((currentDetail) =>
        currentDetail
          ? { ...currentDetail, readAt: currentDetail.readAt ?? result.readAt }
          : currentDetail
      );
      setNotice({
        tone: "success",
        text: result.updatedCount
          ? "All conversations marked read."
          : "Inbox was already up to date."
      });
      onNotificationsChanged();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Inbox could not be updated."
      });
    } finally {
      setUpdatingKey(null);
    }
  }

  async function handleReply(conversation: InboxConversationDetail, body: string) {
    if (conversation.source !== "SUPPORT_REQUEST") {
      throw new Error("This conversation does not accept replies.");
    }

    const conversationKey = getInboxConversationKey(conversation);
    setUpdatingKey(conversationKey);

    try {
      const createdMessage = await apiRequest<SupportRequestMessageRecord>(
        `/api/support/requests/${conversation.id}/messages`,
        {
          body: JSON.stringify({ message: body }),
          method: "POST"
        }
      );
      const inboxMessage: InboxMessageRecord = {
        author: "USER",
        body: createdMessage.message,
        createdAt: createdMessage.createdAt,
        id: createdMessage.id,
        senderName: "You"
      };
      setDetail((currentDetail) =>
        currentDetail && getInboxConversationKey(currentDetail) === conversationKey
          ? {
              ...currentDetail,
              messages: [...currentDetail.messages, inboxMessage],
              preview: createdMessage.message,
              readAt: createdMessage.createdAt,
              updatedAt: createdMessage.createdAt
            }
          : currentDetail
      );
      setConversations((currentConversations) =>
        currentConversations.map((currentConversation) =>
          getInboxConversationKey(currentConversation) === conversationKey
            ? {
                ...currentConversation,
                preview: createdMessage.message,
                readAt: createdMessage.createdAt,
                updatedAt: createdMessage.createdAt
              }
            : currentConversation
        )
      );
      setNotice({ tone: "success", text: "Message sent." });
      onNotificationsChanged();
    } finally {
      setUpdatingKey(null);
    }
  }

  function handleCreated(request: SupportRequestRecord) {
    setIsComposing(false);
    setSelectedKey(`SUPPORT_REQUEST:${request.id}`);
    setIsMobileDetailOpen(true);
    setNotice({ tone: "success", text: "Message sent to ProofPilot Support." });
    setReloadKey((currentKey) => currentKey + 1);
    onNotificationsChanged();
  }

  const showMobileWorkspace = isComposing || isMobileDetailOpen;

  return (
    <section aria-labelledby="inbox-heading" className="grid gap-4">
      <header
        className={cn(
          "flex flex-wrap items-end justify-between gap-4",
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
            disabled={!unreadCount || updatingKey === "all"}
            onClick={() => {
              void handleMarkAllRead();
            }}
            type="button"
            variant="outline"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Mark all read
          </Button>
          <Button
            onClick={() => {
              setIsComposing(true);
              setIsMobileDetailOpen(false);
              setNotice(null);
            }}
            type="button"
          >
            <MailPlus className="h-4 w-4" aria-hidden="true" />
            New message
          </Button>
        </div>
      </header>

      {notice ? (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            notice.tone === "success"
              ? "border-teal-400/30 bg-teal-400/10 text-teal-100"
              : "border-red-400/30 bg-red-400/10 text-red-100"
          )}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.text}
        </p>
      ) : null}

      {isComposing ? (
        <InboxComposer
          cases={cases}
          initialCaseId={selectedCaseId}
          onCancel={() => setIsComposing(false)}
          onCreated={handleCreated}
        />
      ) : (
        <>
          <div
            className={cn(
              "grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center",
              isMobileDetailOpen ? "hidden md:grid" : null
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
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search messages"
                type="search"
                value={searchQuery}
              />
              {searchQuery ? (
                <Button
                  aria-label="Clear message search"
                  className="absolute right-0 top-1/2 -translate-y-1/2"
                  onClick={() => setSearchQuery("")}
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
              onChange={(event) => setSort(event.target.value as InboxSort)}
              value={sort}
            >
              <option value="NEWEST">Sort: Newest</option>
              <option value="OLDEST">Sort: Oldest</option>
            </Select>
          </div>

          <div
            aria-label="Filter messages"
            className={cn(
              "flex gap-1 overflow-x-auto border border-border bg-card p-1 scroll-container",
              isMobileDetailOpen ? "hidden md:flex" : null
            )}
            role="group"
          >
            <InboxFilterButton
              active={filter === "ALL"}
              count={conversations.length}
              label="All"
              onClick={() => setFilter("ALL")}
            />
            <InboxFilterButton
              active={filter === "UNREAD"}
              count={unreadCount}
              label="Unread"
              onClick={() => setFilter("UNREAD")}
            />
            {inboxCategoryOptions.map((option) => (
              <InboxFilterButton
                active={filter === option.value}
                count={
                  conversations.filter(
                    (conversation) => conversation.category === option.value
                  ).length
                }
                key={option.value}
                label={option.label}
                onClick={() => setFilter(option.value)}
              />
            ))}
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(16rem,0.78fr)_minmax(0,1.22fr)] md:items-start xl:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)]">
            <section
              aria-labelledby="conversation-list-heading"
              className={cn(
                "min-w-0 overflow-hidden border border-border bg-card",
                isMobileDetailOpen ? "hidden md:block" : null
              )}
            >
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold" id="conversation-list-heading">
                    Conversations
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {filteredConversations.length} shown
                  </p>
                </div>
                <Badge variant={unreadCount ? "default" : "secondary"}>
                  {unreadCount} unread
                </Badge>
              </div>

              {isLoading ? (
                <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                  Loading conversations
                </div>
              ) : filteredConversations.length ? (
                <div className="scroll-container md:max-h-[48rem] md:overflow-y-auto">
                  {filteredConversations.map((conversation) => (
                    <InboxRow
                      active={getInboxConversationKey(conversation) === selectedKey}
                      conversation={conversation}
                      key={getInboxConversationKey(conversation)}
                      onOpen={(selectedConversation) => {
                        void handleOpenConversation(selectedConversation);
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

            <div className={cn(isMobileDetailOpen ? "block" : "hidden md:block")}>
              <InboxDetail
                conversation={detail}
                isLoading={isDetailLoading}
                isUpdating={detail ? updatingKey === getInboxConversationKey(detail) : false}
                key={detail ? getInboxConversationKey(detail) : "empty-conversation"}
                onBack={() => setIsMobileDetailOpen(false)}
                onMarkUnread={handleMarkUnread}
                onOpenCase={onOpenCase}
                onReply={handleReply}
                ownerName={ownerName}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

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
