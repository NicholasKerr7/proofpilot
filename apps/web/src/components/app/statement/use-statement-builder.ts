"use client";

import { useEffect, useState } from "react";
import {
  statementGuidanceFields,
  type SaveStatementGuidanceInput
} from "@proofpilot/types";
import { emptyStatementGuidance } from "@/components/app/statement/statement-guidance";
import { apiRequest } from "@/lib/client/api";
import type {
  CaseRecord,
  CaseStatement,
  CaseStatementResponse,
  GeneratedCaseSummary,
  StatementGuidance
} from "@/lib/client/types";

export interface StatementNotice {
  caseId: string;
  tone: "success" | "error" | "info";
  text: string;
}

interface UseStatementBuilderInput {
  onCaseChanged: (caseId: string) => Promise<unknown>;
  readOnly: boolean;
  selectedCase: CaseRecord;
}

/** Owns statement loading, versioning, guidance persistence, and summary generation. */
export function useStatementBuilder({
  onCaseChanged,
  readOnly,
  selectedCase
}: UseStatementBuilderInput) {
  const [statement, setStatement] = useState<CaseStatement | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [savedDraftContent, setSavedDraftContent] = useState("");
  const [guidance, setGuidance] = useState<SaveStatementGuidanceInput>({
    ...emptyStatementGuidance
  });
  const [savedGuidance, setSavedGuidance] = useState<SaveStatementGuidanceInput>({
    ...emptyStatementGuidance
  });
  const [summary, setSummary] = useState<GeneratedCaseSummary | null>(null);
  const [summaryHistoryCount, setSummaryHistoryCount] = useState(0);
  const [notice, setNotice] = useState<StatementNotice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGuidanceSaving, setIsGuidanceSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSummaryGenerating, setIsSummaryGenerating] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadStatement() {
      setIsLoading(true);

      try {
        const response = await apiRequest<CaseStatementResponse>(
          `/api/cases/${selectedCase.id}/statement`
        );

        if (!isMounted) {
          return;
        }

        const initialContent = response.statement?.content ?? selectedCase.summary ?? "";
        const initialGuidance = toGuidanceInput(response.guidance);
        setStatement(response.statement);
        setDraftContent(initialContent);
        setSavedDraftContent(initialContent);
        setGuidance(initialGuidance);
        setSavedGuidance(initialGuidance);
        setSummary(response.summary);
        setSummaryHistoryCount(response.summaryHistory.length);
      } catch (error) {
        if (isMounted) {
          const initialContent = selectedCase.summary ?? "";
          setStatement(null);
          setDraftContent(initialContent);
          setSavedDraftContent(initialContent);
          setGuidance({ ...emptyStatementGuidance });
          setSavedGuidance({ ...emptyStatementGuidance });
          setSummary(null);
          setSummaryHistoryCount(0);
          setNotice({
            caseId: selectedCase.id,
            tone: "error",
            text:
              error instanceof Error
                ? error.message
                : "Statement workspace could not be loaded."
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadStatement();

    return () => {
      isMounted = false;
    };
  }, [selectedCase.id, selectedCase.summary]);

  const draftIsDirty = draftContent !== savedDraftContent;
  const guidanceIsDirty = !isGuidanceEqual(guidance, savedGuidance);
  const isBusy =
    isLoading ||
    isSaving ||
    isGuidanceSaving ||
    isGenerating ||
    isSummaryGenerating ||
    restoringVersionId !== null;
  const latestVersion = statement?.versions[0];
  const canSave = !readOnly && draftContent.trim().length > 0 && draftIsDirty && !isBusy;
  const visibleNotice = notice?.caseId === selectedCase.id ? notice : null;

  /** Associates transient feedback with the active case to avoid cross-case leakage. */
  function showNotice(nextNotice: Omit<StatementNotice, "caseId">) {
    setNotice({
      ...nextNotice,
      caseId: selectedCase.id
    });
  }

  /** Persists the current draft and advances immutable version history. */
  async function persistDraft() {
    const savedStatement = await apiRequest<CaseStatement>(
      `/api/cases/${selectedCase.id}/statement`,
      {
        body: JSON.stringify({ content: draftContent }),
        method: "PUT"
      }
    );
    setStatement(savedStatement);
    setDraftContent(savedStatement.content);
    setSavedDraftContent(savedStatement.content);
    return savedStatement;
  }

  /** Persists guided answers used by draft and summary generation. */
  async function persistGuidance() {
    const saved = await apiRequest<StatementGuidance>(
      `/api/cases/${selectedCase.id}/statement/guidance`,
      {
        body: JSON.stringify(guidance),
        method: "PUT"
      }
    );
    const savedInput = toGuidanceInput(saved);
    setGuidance(savedInput);
    setSavedGuidance(savedInput);
    return saved;
  }

  /** Saves a user-edited statement version. */
  async function saveDraft() {
    setIsSaving(true);
    setNotice(null);

    try {
      await persistDraft();
      await onCaseChanged(selectedCase.id);
      showNotice({ tone: "success", text: "Statement version saved." });
    } catch (error) {
      showNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Statement could not be saved."
      });
    } finally {
      setIsSaving(false);
    }
  }

  /** Saves guided answers without generating new content. */
  async function saveGuidance() {
    setIsGuidanceSaving(true);
    setNotice(null);

    try {
      await persistGuidance();
      showNotice({ tone: "success", text: "Guided answers saved." });
    } catch (error) {
      showNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Guided answers could not be saved."
      });
    } finally {
      setIsGuidanceSaving(false);
    }
  }

  /** Saves dirty guidance before generating and versioning a new statement draft. */
  async function generateDraft() {
    setIsGenerating(true);
    showNotice({ tone: "info", text: "Generating a draft from the saved case record..." });

    try {
      if (guidanceIsDirty) {
        setIsGuidanceSaving(true);
        await persistGuidance();
      }

      const generatedStatement = await apiRequest<CaseStatement>(
        `/api/cases/${selectedCase.id}/statement/generate`,
        { method: "POST" }
      );
      setStatement(generatedStatement);
      setDraftContent(generatedStatement.content);
      setSavedDraftContent(generatedStatement.content);
      await onCaseChanged(selectedCase.id);
      showNotice({
        tone: "success",
        text: "Statement draft generated and saved as a new version."
      });
    } catch (error) {
      showNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Statement could not be generated."
      });
    } finally {
      setIsGuidanceSaving(false);
      setIsGenerating(false);
    }
  }

  /** Saves dirty inputs before generating a summary from the current case record. */
  async function generateSummary() {
    setIsSummaryGenerating(true);
    showNotice({ tone: "info", text: "Reviewing the saved timeline and evidence..." });

    try {
      if (guidanceIsDirty) {
        setIsGuidanceSaving(true);
        await persistGuidance();
      }

      if (draftIsDirty && draftContent.trim()) {
        setIsSaving(true);
        await persistDraft();
      }

      const generatedSummary = await apiRequest<GeneratedCaseSummary>(
        `/api/cases/${selectedCase.id}/summary/generate`,
        { method: "POST" }
      );
      setSummary(generatedSummary);
      setSummaryHistoryCount((count) => Math.min(5, count + 1));
      await onCaseChanged(selectedCase.id);
      showNotice({
        tone: "success",
        text: "Case summary generated from the saved record."
      });
    } catch (error) {
      showNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Case summary could not be generated."
      });
    } finally {
      setIsGuidanceSaving(false);
      setIsSaving(false);
      setIsSummaryGenerating(false);
    }
  }

  /** Restores historical content as a new current statement version. */
  async function restoreVersion(versionId: string) {
    setRestoringVersionId(versionId);
    setNotice(null);

    try {
      const restoredStatement = await apiRequest<CaseStatement>(
        `/api/cases/${selectedCase.id}/statement/versions/${versionId}/restore`,
        { method: "POST" }
      );
      setStatement(restoredStatement);
      setDraftContent(restoredStatement.content);
      setSavedDraftContent(restoredStatement.content);
      await onCaseChanged(selectedCase.id);
      showNotice({
        tone: "success",
        text: "Statement version restored as the current version."
      });
    } catch (error) {
      showNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Statement version could not be restored."
      });
    } finally {
      setRestoringVersionId(null);
    }
  }

  return {
    canSave,
    draftContent,
    draftIsDirty,
    generateDraft,
    generateSummary,
    guidance,
    guidanceIsDirty,
    isBusy,
    isGenerating,
    isGuidanceSaving,
    isSaving,
    isSummaryGenerating,
    latestVersion,
    restoringVersionId,
    restoreVersion,
    saveDraft,
    saveGuidance,
    setDraftContent,
    setGuidance,
    statement,
    summary,
    summaryHistoryCount,
    visibleNotice
  };
}

/** Converts nullable API guidance into the editor's string-only form contract. */
function toGuidanceInput(
  guidance: StatementGuidance | null
): SaveStatementGuidanceInput {
  if (!guidance) {
    return { ...emptyStatementGuidance };
  }

  return {
    platformAction: guidance.platformAction,
    actionDate: guidance.actionDate,
    reasonGiven: guidance.reasonGiven,
    accountUse: guidance.accountUse,
    supportContact: guidance.supportContact,
    requestedOutcome: guidance.requestedOutcome,
    supportingDocuments: guidance.supportingDocuments
  };
}

/** Compares every generated guidance field without object identity assumptions. */
function isGuidanceEqual(
  first: SaveStatementGuidanceInput,
  second: SaveStatementGuidanceInput
) {
  return statementGuidanceFields.every((field) => first[field] === second[field]);
}
