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
  getInboxConversationKey,
  matchesInboxFilter,
  matchesInboxSearch,
  sortInboxConversations,
  type InboxFilter,
  type InboxSort
} from "@/components/app/inbox/inbox-utils";
import { apiRequest } from "@/lib/client/api";

export interface InboxNotice {
  text: string;
  tone: "error" | "success";
}

interface UseInboxPanelInput {
  onNotificationsChanged: () => void;
  onUnreadCountChange: (count: number) => void;
  refreshKey: number;
}

/** Owns inbox retrieval, selection, read state, replies, and list preferences. */
export function useInboxPanel({
  onNotificationsChanged,
  onUnreadCountChange,
  refreshKey
}: UseInboxPanelInput) {
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
  const [notice, setNotice] = useState<InboxNotice | null>(null);
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

  /** Persists read state and synchronizes list and detail records. */
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

  /** Selects a conversation and marks unread content read. */
  async function openConversation(conversation: InboxConversationRecord) {
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

  /** Marks the active conversation unread. */
  async function markUnread(conversation: InboxConversationDetail) {
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

  /** Marks every currently unread conversation read in one API operation. */
  async function markAllRead() {
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

  /** Appends a user reply to a support conversation and synchronizes its preview. */
  async function reply(conversation: InboxConversationDetail, body: string) {
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

  /** Selects a newly created support conversation and schedules a list refresh. */
  function handleCreated(request: SupportRequestRecord) {
    setIsComposing(false);
    setSelectedKey(`SUPPORT_REQUEST:${request.id}`);
    setIsMobileDetailOpen(true);
    setNotice({ tone: "success", text: "Message sent to ProofPilot Support." });
    setReloadKey((currentKey) => currentKey + 1);
    onNotificationsChanged();
  }

  return {
    conversations,
    detail,
    filter,
    filteredConversations,
    handleCreated,
    isComposing,
    isDetailLoading,
    isLoading,
    isMobileDetailOpen,
    markAllRead,
    markUnread,
    notice,
    openConversation,
    reply,
    searchQuery,
    selectedKey,
    setDetail,
    setFilter,
    setIsComposing,
    setIsMobileDetailOpen,
    setNotice,
    setSearchQuery,
    setSelectedKey,
    setSort,
    sort,
    unreadCount,
    updatingKey
  };
}
