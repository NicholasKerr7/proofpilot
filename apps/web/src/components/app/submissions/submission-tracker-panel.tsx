"use client";

import type {
  CaseSubmissionRecord,
  CreateCaseSubmissionInput,
  CreateSubmissionUpdateInput
} from "@proofpilot/types";
import { useEffect, useState } from "react";
import { Plus, RadioTower, RefreshCcw } from "lucide-react";
import { SubmissionCreateForm } from "@/components/app/submissions/submission-create-form";
import { SubmissionHistory } from "@/components/app/submissions/submission-history";
import { SubmissionOverview } from "@/components/app/submissions/submission-overview";
import { SubmissionUpdateForm } from "@/components/app/submissions/submission-update-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface SubmissionTrackerPanelProps {
  onCaseChanged: (caseId: string) => Promise<unknown>;
  readOnly: boolean;
  selectedCase: CaseRecord;
}

type Notice = {
  text: string;
  tone: "error" | "success";
};

export function SubmissionTrackerPanel({
  onCaseChanged,
  readOnly,
  selectedCase
}: SubmissionTrackerPanelProps) {
  const [submissions, setSubmissions] = useState<CaseSubmissionRecord[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void apiRequest<CaseSubmissionRecord[]>(
      `/api/cases/${selectedCase.id}/submissions`,
      { signal: controller.signal }
    )
      .then((records) => {
        if (!controller.signal.aborted) {
          setSubmissions(records);
          setSelectedSubmissionId((current) =>
            resolveSelectedSubmissionId(records, current)
          );
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setNotice({
            text:
              error instanceof Error
                ? error.message
                : "Submission history could not be loaded.",
            tone: "error"
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [selectedCase.id]);

  async function loadSubmissions() {
    setNotice(null);

    try {
      const records = await apiRequest<CaseSubmissionRecord[]>(
        `/api/cases/${selectedCase.id}/submissions`
      );
      setSubmissions(records);
      setSelectedSubmissionId((current) =>
        resolveSelectedSubmissionId(records, current)
      );
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Submission history could not be refreshed.",
        tone: "error"
      });
    }
  }

  async function handleCreate(input: CreateCaseSubmissionInput) {
    setIsSubmitting(true);
    setNotice(null);

    try {
      const submission = await apiRequest<CaseSubmissionRecord>(
        `/api/cases/${selectedCase.id}/submissions`,
        {
          body: JSON.stringify(input),
          method: "POST"
        }
      );
      setSubmissions((current) => [submission, ...current]);
      setSelectedSubmissionId(submission.id);
      setNotice({ text: `Appeal round ${submission.round} recorded.`, tone: "success" });
      await onCaseChanged(selectedCase.id);
      return true;
    } catch (error) {
      setNotice({
        text:
          error instanceof Error ? error.message : "Submission could not be recorded.",
        tone: "error"
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddUpdate(input: CreateSubmissionUpdateInput) {
    const selectedSubmission = submissions.find(
      (submission) => submission.id === selectedSubmissionId
    );

    if (!selectedSubmission) {
      return false;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      const updatedSubmission = await apiRequest<CaseSubmissionRecord>(
        `/api/cases/${selectedCase.id}/submissions/${selectedSubmission.id}/updates`,
        {
          body: JSON.stringify(input),
          method: "POST"
        }
      );
      setSubmissions((current) =>
        current.map((submission) =>
          submission.id === updatedSubmission.id
            ? updatedSubmission
            : submission
        )
      );
      setNotice({ text: "Submission update recorded.", tone: "success" });
      await onCaseChanged(selectedCase.id);
      return true;
    } catch (error) {
      setNotice({
        text:
          error instanceof Error
            ? error.message
            : "Submission update could not be recorded.",
        tone: "error"
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedSubmission =
    submissions.find((submission) => submission.id === selectedSubmissionId) ??
    submissions[0] ??
    null;
  const nextRound =
    submissions.reduce(
      (highest, submission) => Math.max(highest, submission.round),
      0
    ) + 1;

  if (isLoading) {
    return (
      <div
        aria-label="Loading submission tracker"
        className="grid min-h-96 place-items-center rounded-md border border-border bg-card"
        role="status"
      >
        <div className="grid justify-items-center gap-3">
          <RadioTower
            className="h-7 w-7 text-primary motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            Loading appeal history...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5" id="submission-tracker">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Preserve every submission, platform response, follow-up, and decision
          across appeal rounds.
        </p>
        {!readOnly ? (
          <Button
            aria-expanded={isCreateOpen}
            onClick={() => setIsCreateOpen((current) => !current)}
            type="button"
            variant={isCreateOpen ? "secondary" : "default"}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New appeal round
          </Button>
        ) : null}
      </div>

      {notice ? (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            notice.tone === "error"
              ? "border-red-400/30 bg-red-400/10 text-red-100"
              : "border-teal-400/30 bg-teal-400/10 text-teal-100"
          )}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.text}
        </p>
      ) : null}

      {isCreateOpen ? (
        <SubmissionCreateForm
          isSubmitting={isSubmitting}
          onCancel={() => setIsCreateOpen(false)}
          onSubmit={handleCreate}
          round={nextRound}
        />
      ) : null}

      {selectedSubmission ? (
        <>
          {submissions.length > 1 ? (
            <div
              aria-label="Select appeal round"
              className="flex gap-1 overflow-x-auto rounded-md border border-border bg-card p-1 scroll-container"
              role="group"
            >
              {submissions.map((submission) => (
                <Button
                  aria-pressed={selectedSubmission.id === submission.id}
                  className="shrink-0"
                  key={submission.id}
                  onClick={() => setSelectedSubmissionId(submission.id)}
                  size="sm"
                  type="button"
                  variant={
                    selectedSubmission.id === submission.id
                      ? "secondary"
                      : "ghost"
                  }
                >
                  Round {submission.round}
                </Button>
              ))}
            </div>
          ) : null}

          <SubmissionOverview submission={selectedSubmission} />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] xl:items-start">
            <SubmissionHistory updates={selectedSubmission.updates} />
            {!readOnly ? (
              <SubmissionUpdateForm
                isSubmitting={isSubmitting}
                key={selectedSubmission.id}
                onSubmit={handleAddUpdate}
                round={selectedSubmission.round}
              />
            ) : null}
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="grid min-h-72 place-items-center p-6 text-center">
            <div className="max-w-md">
              <RadioTower
                className="mx-auto h-7 w-7 text-muted-foreground"
                aria-hidden="true"
              />
              <h2 className="mt-3 text-lg font-semibold">
                No submission recorded
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Record the delivery channel and confirmation after the appeal
                leaves ProofPilot.
              </p>
              {!readOnly ? (
                <Button
                  className="mt-5"
                  onClick={() => setIsCreateOpen(true)}
                  type="button"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Record first submission
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedSubmission && !isCreateOpen ? (
        <Button
          className="justify-self-start"
          onClick={() => {
            void loadSubmissions();
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Refresh history
        </Button>
      ) : null}
    </div>
  );
}

function resolveSelectedSubmissionId(
  submissions: CaseSubmissionRecord[],
  currentSubmissionId: string
) {
  return submissions.some(
    (submission) => submission.id === currentSubmissionId
  )
    ? currentSubmissionId
    : (submissions[0]?.id ?? "");
}
