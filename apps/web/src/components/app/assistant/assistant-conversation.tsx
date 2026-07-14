import type { FormEvent, RefObject } from "react";
import Image from "next/image";
import { Info, Send, Sparkles } from "lucide-react";
import type {
  AssistantCapability,
  AssistantMessage
} from "@proofpilot/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface AssistantConversationProps {
  capability: AssistantCapability;
  caseTitle: string;
  draft: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isSending: boolean;
  messages: AssistantMessage[];
  onDraftChange: (value: string) => void;
  onPrompt: (prompt: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  suggestedPrompts: string[];
  userName: string;
}

export function AssistantConversation({
  capability,
  caseTitle,
  draft,
  inputRef,
  isSending,
  messages,
  onDraftChange,
  onPrompt,
  onSubmit,
  suggestedPrompts,
  userName
}: AssistantConversationProps) {
  return (
    <section
      aria-labelledby="assistant-conversation-heading"
      className="min-w-0 rounded-lg border border-border bg-card shadow-[0_18px_60px_rgba(0,0,0,0.18)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <h2 id="assistant-conversation-heading" className="text-base font-semibold">
              AI Assistant
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Case-aware guidance from your saved workspace.
          </p>
        </div>
        <Badge variant="secondary">
          <Info className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Guided mode
        </Badge>
      </div>

      <div className="grid gap-5 px-4 py-5 sm:px-5" aria-live="polite">
        <AssistantMessageBubble
          content={`Hi ${getFirstName(userName)}. I can review the records saved in ${caseTitle}, identify evidence gaps, summarize its current state, and point you to the next case tool.`}
          createdAt={null}
          role="ASSISTANT"
        />

        {messages.map((message) => (
          <AssistantMessageBubble
            key={message.id}
            content={message.content}
            createdAt={message.createdAt}
            role={message.role}
          />
        ))}

        {isSending ? (
          <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
            <AssistantAvatar />
            <span>Reviewing saved case records...</span>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2" aria-label="Suggested assistant prompts">
          {suggestedPrompts.slice(0, 3).map((prompt) => (
            <Button
              key={prompt}
              className="h-auto min-h-10 whitespace-normal px-3 py-2 text-left"
              disabled={isSending}
              onClick={() => onPrompt(prompt)}
              size="sm"
              type="button"
              variant="outline"
            >
              {prompt}
            </Button>
          ))}
        </div>

        <form className="grid gap-3 border-t border-border pt-4" onSubmit={onSubmit}>
          <label htmlFor="assistant-prompt" className="sr-only">
            Ask about this case
          </label>
          <Textarea
            id="assistant-prompt"
            className="min-h-24 resize-y"
            disabled={isSending}
            maxLength={2000}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Ask about evidence, your timeline, or the next step..."
            ref={inputRef}
            value={draft}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{draft.length}/2000</span>
            <Button disabled={isSending || draft.trim().length < 2} type="submit">
              <Send className="h-4 w-4" aria-hidden="true" />
              Send
            </Button>
          </div>
        </form>

        <p className="text-xs leading-5 text-muted-foreground">
          {capability.modelGeneration
            ? "Generated guidance can miss context. Review it before use."
            : "Guided responses use saved case records. No case data is sent to an external model provider."}
        </p>
      </div>
    </section>
  );
}

interface AssistantMessageBubbleProps {
  content: string;
  createdAt: string | null;
  role: "ASSISTANT" | "USER";
}

function AssistantMessageBubble({ content, createdAt, role }: AssistantMessageBubbleProps) {
  const isAssistant = role === "ASSISTANT";

  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-3",
        isAssistant ? "justify-start" : "justify-end"
      )}
    >
      {isAssistant ? <AssistantAvatar /> : null}
      <div
        className={cn(
          "min-w-0 max-w-[88%] rounded-lg border px-4 py-3 sm:max-w-[82%]",
          isAssistant
            ? "border-border bg-secondary/35"
            : "border-primary/30 bg-primary/10"
        )}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
          {content}
        </p>
        {createdAt ? (
          <p className="mt-2 text-right text-[11px] text-muted-foreground">
            {formatMessageTime(createdAt)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-background">
      <Image
        alt=""
        className="h-7 w-7 object-contain"
        height={28}
        src="/brand/proofpilot-brand-icon-transparent.webp"
        width={28}
      />
    </span>
  );
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
