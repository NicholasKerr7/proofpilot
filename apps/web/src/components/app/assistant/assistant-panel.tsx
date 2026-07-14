"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CircleAlert, Plus, RefreshCw, Sparkles } from "lucide-react";
import type {
  AssistantAction,
  AssistantExchange,
  AssistantWorkspace
} from "@proofpilot/types";
import { AssistantCaseHero } from "@/components/app/assistant/assistant-case-hero";
import { AssistantConversation } from "@/components/app/assistant/assistant-conversation";
import { AssistantSidebar } from "@/components/app/assistant/assistant-sidebar";
import type { CaseDestinationId } from "@/components/app/cases/case-utils";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/client/api";
import type { AuthUser, CaseRecord } from "@/lib/client/types";

interface AssistantPanelProps {
  cases: CaseRecord[];
  onCreateCase: () => void;
  onOpenCase: (caseId: string, destinationId: CaseDestinationId) => Promise<void>;
  onSelectCase: (caseId: string) => Promise<void>;
  selectedCase: CaseRecord | null;
  user: AuthUser;
}

export function AssistantPanel({
  cases,
  onCreateCase,
  onOpenCase,
  onSelectCase,
  selectedCase,
  user
}: AssistantPanelProps) {
  const [workspace, setWorkspace] = useState<AssistantWorkspace | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isSelectingCase, setIsSelectingCase] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const assistantCaseId = selectedCase?.id ?? null;

  useEffect(() => {
    if (!assistantCaseId) {
      return;
    }

    const controller = new AbortController();

    void apiRequest<AssistantWorkspace>(`/api/assistant/cases/${assistantCaseId}`, {
      signal: controller.signal
    })
      .then((nextWorkspace) => setWorkspace(nextWorkspace))
      .catch((requestError: unknown) => {
        if (!isAbortError(requestError)) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Assistant workspace could not be loaded."
          );
        }
      });

    return () => controller.abort();
  }, [assistantCaseId, reloadKey]);

  async function handleSelectCase(caseId: string) {
    if (caseId === selectedCase?.id) {
      return;
    }

    setIsSelectingCase(true);
    setError(null);
    setDraft("");
    try {
      await onSelectCase(caseId);
    } catch (selectionError) {
      setError(
        selectionError instanceof Error ? selectionError.message : "Case could not be selected."
      );
    } finally {
      setIsSelectingCase(false);
    }
  }

  function handlePrompt(prompt: string) {
    setDraft(prompt);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();

    if (!selectedCase || !workspace || content.length < 2 || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);
    const requestCaseId = selectedCase.id;
    try {
      const exchange = await apiRequest<AssistantExchange>(
        `/api/assistant/cases/${requestCaseId}/messages`,
        {
          body: JSON.stringify({ content }),
          method: "POST"
        }
      );
      setWorkspace((currentWorkspace) =>
        currentWorkspace?.case.id === requestCaseId
          ? {
              ...currentWorkspace,
              messages: [
                ...currentWorkspace.messages,
                exchange.userMessage,
                exchange.assistantMessage
              ],
              threadId: exchange.threadId
            }
          : currentWorkspace
      );
      setDraft("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Guided response could not be created."
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleAction(action: AssistantAction) {
    if (selectedCase) {
      void onOpenCase(selectedCase.id, action.destinationId);
    }
  }

  if (!selectedCase) {
    return (
      <section className="grid min-h-96 place-items-center rounded-lg border border-dashed border-border bg-card px-5 py-10 text-center">
        <div className="max-w-md">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold">AI Assistant</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Create a case before asking for case-aware guidance.
          </p>
          <Button className="mt-5" onClick={onCreateCase} type="button">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create case
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="assistant-heading" className="grid gap-5">
      <div className="md:hidden">
        <p className="text-sm font-semibold text-primary">Case guidance</p>
        <h1 id="assistant-heading" className="mt-1 text-2xl font-semibold sm:text-3xl">
          AI Assistant
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Review saved case facts, find gaps, and move directly to the tool that needs attention.
        </p>
      </div>

      {error ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          <span className="flex items-center gap-2">
            <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </span>
          <Button
            onClick={() => {
              setError(null);
              setReloadKey((currentKey) => currentKey + 1);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      ) : null}

      {workspace?.case.id === selectedCase.id ? (
        <>
          <AssistantCaseHero
            cases={cases}
            isSelectingCase={isSelectingCase || isSending}
            onOpenCurrentCase={() => {
              void onOpenCase(selectedCase.id, "case-overview");
            }}
            onSelectCase={(caseId) => {
              void handleSelectCase(caseId);
            }}
            selectedCase={selectedCase}
            summary={workspace.case}
          />

          <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1.65fr)_minmax(250px,0.85fr)] md:items-start">
            <AssistantConversation
              capability={workspace.capability}
              caseTitle={workspace.case.title}
              draft={draft}
              inputRef={inputRef}
              isSending={isSending}
              messages={workspace.messages}
              onDraftChange={setDraft}
              onPrompt={handlePrompt}
              onSubmit={(event) => {
                void handleSubmit(event);
              }}
              suggestedPrompts={workspace.suggestedPrompts}
              userName={user.name ?? user.email}
            />
            <AssistantSidebar
              actions={workspace.nextActions}
              caseSummary={workspace.case}
              isSending={isSending}
              onAction={handleAction}
              onPrompt={handlePrompt}
              prompts={workspace.suggestedPrompts}
            />
          </div>
        </>
      ) : !error ? (
        <div className="grid min-h-96 place-items-center rounded-lg border border-border bg-card px-5 py-10">
          <div className="text-center" role="status">
            <Sparkles className="mx-auto h-6 w-6 text-primary" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted-foreground">Loading case guidance...</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
