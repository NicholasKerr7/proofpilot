"use client";

import { useState } from "react";
import type { SaveStatementGuidanceInput, StatementGuidanceField } from "@proofpilot/types";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  Files,
  Headphones,
  MessageSquareText,
  Save,
  Target,
  type LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface StatementGuidanceProps {
  answers: SaveStatementGuidanceInput;
  disabled: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onAnswersChange: (answers: SaveStatementGuidanceInput) => void;
  onSave: () => void;
  platform: string;
}

interface GuidancePrompt {
  description: string;
  field: StatementGuidanceField;
  icon: LucideIcon;
  maxLength: number;
  placeholder: string;
  shortTitle: string;
  title: string;
  variant: "input" | "textarea";
}

const guidancePrompts: GuidancePrompt[] = [
  {
    description: "Describe the platform action in your own words.",
    field: "platformAction",
    icon: Building2,
    maxLength: 500,
    placeholder: "The platform permanently limited my account...",
    shortTitle: "Account action",
    title: "What platform closed or restricted your account?",
    variant: "input"
  },
  {
    description: "Use the exact date when known, or explain the approximate timing.",
    field: "actionDate",
    icon: CalendarDays,
    maxLength: 160,
    placeholder: "The restriction began on May 12, 2026...",
    shortTitle: "Action date",
    title: "When did this happen?",
    variant: "input"
  },
  {
    description: "Use the wording from the notice or support response when possible.",
    field: "reasonGiven",
    icon: MessageSquareText,
    maxLength: 2000,
    placeholder: "The notice said the account was under review because...",
    shortTitle: "Reason given",
    title: "What reason did they give?",
    variant: "textarea"
  },
  {
    description: "Summarize the legitimate personal or business activity on the account.",
    field: "accountUse",
    icon: BriefcaseBusiness,
    maxLength: 2000,
    placeholder: "I used the account to receive customer payments and pay vendors...",
    shortTitle: "Account use",
    title: "How did you use the account?",
    variant: "textarea"
  },
  {
    description: "Record the channels used, dates, and any information already supplied.",
    field: "supportContact",
    icon: Headphones,
    maxLength: 2000,
    placeholder: "I contacted support through email and supplied...",
    shortTitle: "Support contact",
    title: "Did you contact support?",
    variant: "textarea"
  },
  {
    description: "State the specific decision or next step you want from the reviewer.",
    field: "requestedOutcome",
    icon: Target,
    maxLength: 1200,
    placeholder: "I am requesting restored access after a review of...",
    shortTitle: "Requested outcome",
    title: "What outcome are you requesting?",
    variant: "textarea"
  },
  {
    description: "List the strongest records already saved or still being gathered.",
    field: "supportingDocuments",
    icon: Files,
    maxLength: 2000,
    placeholder: "The attached restriction notice, support emails, and ownership records...",
    shortTitle: "Supporting records",
    title: "What documents support your case?",
    variant: "textarea"
  }
];

export function StatementGuidance({
  answers,
  disabled,
  isDirty,
  isSaving,
  onAnswersChange,
  onSave,
  platform
}: StatementGuidanceProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activePrompt = guidancePrompts[activeIndex] ?? guidancePrompts[0];
  const answeredCount = guidancePrompts.filter(
    (prompt) => answers[prompt.field].trim().length > 0
  ).length;
  const progress = Math.round((answeredCount / guidancePrompts.length) * 100);

  if (!activePrompt) {
    return null;
  }

  const ActiveIcon = activePrompt.icon;
  const activeValue = answers[activePrompt.field];

  function updateAnswer(value: string) {
    onAnswersChange({
      ...answers,
      [activePrompt.field]: value
    });
  }

  return (
    <section
      aria-labelledby="statement-guidance-title"
      className="rounded-md border border-border bg-secondary/20 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Guided context</p>
          <h4 id="statement-guidance-title" className="mt-1 text-sm font-semibold text-foreground">
            Build the factual record
          </h4>
        </div>
        <span className="text-xs text-muted-foreground">
          {answeredCount} of {guidancePrompts.length} answered
        </span>
      </div>
      <Progress
        ariaLabel="Guided statement answer progress"
        className="mt-3"
        value={progress}
      />

      <div className="mt-5 grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]">
        <nav className="hidden gap-2 md:grid" aria-label="Guided statement questions">
          {guidancePrompts.map((prompt, index) => {
            const Icon = prompt.icon;
            const isActive = index === activeIndex;
            const isAnswered = answers[prompt.field].trim().length > 0;

            return (
              <button
                key={prompt.field}
                type="button"
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "grid min-h-12 grid-cols-[1.25rem_minmax(0,1fr)_1rem] items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "proof-nav-active border-primary/45 text-foreground"
                    : "border-border bg-background/20 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
                disabled={disabled}
                onClick={() => setActiveIndex(index)}
              >
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>{prompt.shortTitle}</span>
                {isAnswered ? <Check className="h-3.5 w-3.5 text-teal-300" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 rounded-md border border-border bg-background/35 p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
              <ActiveIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-primary">
                Question {activeIndex + 1} of {guidancePrompts.length}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{platform} appeal context</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <Label htmlFor={`statement-guidance-${activePrompt.field}`} className="text-sm leading-6">
              {activePrompt.title}
            </Label>
            <p className="text-xs leading-5 text-muted-foreground">{activePrompt.description}</p>
            {activePrompt.variant === "input" ? (
              <Input
                disabled={disabled}
                id={`statement-guidance-${activePrompt.field}`}
                maxLength={activePrompt.maxLength}
                onChange={(event) => updateAnswer(event.target.value)}
                placeholder={activePrompt.placeholder}
                value={activeValue}
              />
            ) : (
              <Textarea
                className="min-h-36 resize-y"
                disabled={disabled}
                id={`statement-guidance-${activePrompt.field}`}
                maxLength={activePrompt.maxLength}
                onChange={(event) => updateAnswer(event.target.value)}
                placeholder={activePrompt.placeholder}
                value={activeValue}
              />
            )}
            <span className="text-right text-xs text-muted-foreground">
              {activeValue.length.toLocaleString()} / {activePrompt.maxLength.toLocaleString()}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={disabled || activeIndex === 0}
              onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={disabled || activeIndex === guidancePrompts.length - 1}
              onClick={() =>
                setActiveIndex((index) => Math.min(guidancePrompts.length - 1, index + 1))
              }
            >
              Next
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">
          {isDirty ? "Answers have unsaved changes" : "Guided answers are saved"}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !isDirty}
          onClick={onSave}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {isSaving ? "Saving..." : "Save answers"}
        </Button>
      </div>
    </section>
  );
}

export const emptyStatementGuidance: SaveStatementGuidanceInput = {
  platformAction: "",
  actionDate: "",
  reasonGiven: "",
  accountUse: "",
  supportContact: "",
  requestedOutcome: "",
  supportingDocuments: ""
};
