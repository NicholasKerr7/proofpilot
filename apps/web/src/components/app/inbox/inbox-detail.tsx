"use client";

import { type FormEvent, useState } from "react";
import type {
  InboxConversationCategory,
  InboxConversationDetail,
  InboxMessageRecord
} from "@proofpilot/types";
import {
  ArrowLeft,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCheck,
  Headphones,
  LoaderCircle,
  MailOpen,
  Send,
  UsersRound
} from "lucide-react";
import {
  formatCaseDate,
  formatCaseStatus,
  getCaseStatusVariant
} from "@/components/app/cases/case-utils";
import {
  formatInboxMessageDate,
  getInboxCategoryLabel,
  getInboxCategoryVariant
} from "@/components/app/inbox/inbox-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface InboxDetailProps {
  conversation: InboxConversationDetail | null;
  isLoading: boolean;
  isUpdating: boolean;
  onBack: () => void;
  onMarkUnread: (conversation: InboxConversationDetail) => Promise<void>;
  onOpenCase: (caseId: string) => void;
  onReply: (conversation: InboxConversationDetail, body: string) => Promise<void>;
  ownerName: string;
}

export function InboxDetail({
  conversation,
  isLoading,
  isUpdating,
  onBack,
  onMarkUnread,
  onOpenCase,
  onReply,
  ownerName
}: InboxDetailProps) {
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!conversation) {
      return;
    }

    const body = reply.trim();

    if (body.length < 2) {
      setReplyError("Enter at least 2 characters.");
      return;
    }

    setReplyError(null);

    try {
      await onReply(conversation, body);
      setReply("");
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "Message could not be sent.");
    }
  }

  if (isLoading) {
    return (
      <div className="grid min-h-96 place-items-center border border-border bg-card p-6">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
          Loading conversation
        </p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="grid min-h-96 place-items-center border border-dashed border-border bg-card p-6 text-center">
        <div>
          <MailOpen className="mx-auto h-7 w-7 text-primary" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-semibold">Select a conversation</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Choose an inbox item to review its full history and related case.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="inbox-conversation-heading"
      className="min-w-0 overflow-hidden border border-border bg-card"
    >
      <header className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              aria-label="Back to conversations"
              className="shrink-0 md:hidden"
              onClick={onBack}
              size="icon"
              title="Back to conversations"
              type="button"
              variant="ghost"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
              {renderDetailIcon(conversation.category)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words text-sm font-semibold text-foreground">
                  {conversation.participantName}
                </p>
                <Badge variant={getInboxCategoryVariant(conversation.category)}>
                  {getInboxCategoryLabel(conversation.category)}
                </Badge>
                {conversation.status ? (
                  <Badge variant="secondary">
                    {conversation.status.replaceAll("_", " ").toLowerCase()}
                  </Badge>
                ) : null}
              </div>
              <h2
                className="mt-3 break-words text-lg font-semibold leading-7"
                id="inbox-conversation-heading"
              >
                {conversation.subject}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Updated {formatInboxMessageDate(conversation.updatedAt)}
              </p>
            </div>
          </div>

          <Button
            aria-label="Mark conversation unread"
            className="shrink-0"
            disabled={isUpdating || !conversation.readAt}
            onClick={() => {
              void onMarkUnread(conversation);
            }}
            size="icon"
            title="Mark conversation unread"
            type="button"
            variant="ghost"
          >
            <MailOpen className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {conversation.case ? (
        <button
          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-4 text-left transition-colors hover:bg-secondary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5"
          onClick={() => onOpenCase(conversation.case!.id)}
          type="button"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/35 text-primary">
            <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {conversation.case.title}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {conversation.case.deadline ? (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatCaseDate(conversation.case.deadline)}
                </span>
              ) : null}
              <Badge variant={getCaseStatusVariant(conversation.case.status)}>
                {formatCaseStatus(conversation.case.status)}
              </Badge>
            </span>
          </span>
          <span className="text-xs font-semibold text-primary">Open case</span>
        </button>
      ) : null}

      <div
        aria-label="Conversation messages"
        className="scroll-container grid gap-4 p-4 md:max-h-[32rem] md:overflow-y-auto sm:p-5"
        role="region"
        tabIndex={0}
      >
        {conversation.messages.map((message) => (
          <InboxMessageBubble
            key={message.id}
            message={message}
            ownerName={ownerName}
          />
        ))}
      </div>

      <footer className="border-t border-border p-4 sm:p-5">
        {conversation.canReply ? (
          <form className="grid gap-3" onSubmit={handleSubmit}>
            <Textarea
              aria-label="Reply message"
              className="min-h-24"
              maxLength={5000}
              minLength={2}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Type your message..."
              required
              value={reply}
            />
            {replyError ? (
              <p className="text-sm text-red-200" role="alert">
                {replyError}
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {reply.length}/5000
              </p>
              <Button disabled={isUpdating} type="submit">
                {isUpdating ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                {isUpdating ? "Sending..." : "Send"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-200" aria-hidden="true" />
            This update is read-only. Open the related case to take action.
          </div>
        )}
      </footer>
    </section>
  );
}

function InboxMessageBubble({
  message,
  ownerName
}: {
  message: InboxMessageRecord;
  ownerName: string;
}) {
  const isUser = message.author === "USER";

  return (
    <article className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className="max-w-[92%] sm:max-w-[82%]">
        <p
          className={cn(
            "mb-1 text-xs font-semibold",
            isUser ? "text-right text-primary" : "text-muted-foreground"
          )}
        >
          {isUser ? ownerName : message.senderName}
        </p>
        <div
          className={cn(
            "rounded-md border px-3 py-2",
            isUser
              ? "border-primary/45 bg-primary/10"
              : "border-border bg-secondary/25"
          )}
        >
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
            {message.body}
          </p>
          <p className="mt-2 text-right text-[11px] text-muted-foreground">
            {formatInboxMessageDate(message.createdAt)}
          </p>
        </div>
      </div>
    </article>
  );
}

function renderDetailIcon(category: InboxConversationCategory) {
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
