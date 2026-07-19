"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Circle,
  FileText,
  FolderPlus,
  Globe2,
  Lightbulb,
  ListChecks,
  ShieldCheck,
  type LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CaseType, CreateCasePayload } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface CreateCaseFormProps {
  caseTypes: CaseType[];
  isSubmitting: boolean;
  onCancel: () => void;
  onComplete: () => void;
  onCreateCase: (payload: CreateCasePayload) => Promise<boolean>;
}

type CreateCaseStep = 1 | 2;

const platformSuggestions = [
  "PayPal",
  "Cash App",
  "Stripe",
  "Amazon",
  "Chime",
  "Facebook",
  "Instagram",
  "TikTok"
];

export function CreateCaseForm({
  caseTypes,
  isSubmitting,
  onCancel,
  onComplete,
  onCreateCase
}: CreateCaseFormProps) {
  const [step, setStep] = useState<CreateCaseStep>(1);
  const [title, setTitle] = useState("");
  const [caseTypeSlug, setCaseTypeSlug] = useState(
    caseTypes[0]?.slug ?? "account-ban-appeal"
  );
  const [platform, setPlatform] = useState("");
  const [summary, setSummary] = useState("");
  const [deadline, setDeadline] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step === 1) {
      setStep(2);
      return;
    }

    const payload: CreateCasePayload = {
      caseTypeSlug,
      platform: platform.trim(),
      title: title.trim()
    };
    const trimmedSummary = summary.trim();

    if (trimmedSummary) {
      payload.summary = trimmedSummary;
    }

    if (deadline) {
      payload.deadline = new Date(`${deadline}T12:00:00`).toISOString();
    }

    const wasCreated = await onCreateCase(payload);

    if (wasCreated) {
      setTitle("");
      setPlatform("");
      setSummary("");
      setDeadline("");
      setStep(1);
      onComplete();
    }
  }

  function handleBack() {
    if (step === 2) {
      setStep(1);
      return;
    }

    onCancel();
  }

  const selectedCaseType =
    caseTypes.find((caseType) => caseType.slug === caseTypeSlug) ?? caseTypes[0] ?? null;

  return (
    <section aria-labelledby="create-case-heading" className="mx-auto grid w-full max-w-6xl gap-5 2xl:max-w-none">
      <div className="flex items-start gap-3">
        <Button
          aria-label={step === 2 ? "Back to case details" : "Back to cases"}
          onClick={handleBack}
          size="icon"
          title={step === 2 ? "Back to case details" : "Back to cases"}
          type="button"
          variant="outline"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div>
          <p className="text-sm font-semibold text-primary">New private workspace</p>
          <h1 id="create-case-heading" className="mt-1 text-2xl font-semibold sm:text-3xl">
            Create case
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Step {step} of 3</p>
        </div>
      </div>

      <CaseCreationProgress currentStep={step} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <Card>
          <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>{step === 1 ? "Case details" : "Review case"}</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {step === 1
                ? "Add the essential case information. Evidence is uploaded after the case is created."
                : "Confirm these details before opening the evidence workspace."}
            </p>
          </CardHeader>

          <CardContent className="grid gap-4">
            {step === 1 ? (
              <>
                <CaseFormField
                  description="Use a clear name that identifies the platform and issue."
                  icon={FileText}
                  label="Case name"
                >
                  <Input
                    autoComplete="off"
                    id="case-title"
                    maxLength={120}
                    minLength={3}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="PayPal permanent account closure appeal"
                    required
                    value={title}
                  />
                </CaseFormField>

                <CaseFormField
                  description="ProofPilot starts with the Account Ban / Appeal Builder workflow."
                  icon={ListChecks}
                  label="Case type"
                >
                  <Select
                    id="case-type"
                    onChange={(event) => setCaseTypeSlug(event.target.value)}
                    required
                    value={caseTypeSlug}
                  >
                    {caseTypes.map((caseType) => (
                      <option key={caseType.id} value={caseType.slug}>
                        {caseType.name}
                      </option>
                    ))}
                  </Select>
                </CaseFormField>

                <CaseFormField
                  description="Enter the platform where the restriction, hold, or closure occurred."
                  icon={Globe2}
                  label="Platform"
                >
                  <Input
                    autoComplete="organization"
                    id="platform"
                    list="case-platform-options"
                    maxLength={80}
                    onChange={(event) => setPlatform(event.target.value)}
                    placeholder="PayPal"
                    required
                    value={platform}
                  />
                  <datalist id="case-platform-options">
                    {platformSuggestions.map((suggestion) => (
                      <option key={suggestion} value={suggestion} />
                    ))}
                  </datalist>
                </CaseFormField>

                <CaseFormField
                  description="Summarize what happened and the outcome you are requesting."
                  icon={FolderPlus}
                  label="Short description"
                >
                  <Textarea
                    id="summary"
                    maxLength={1_000}
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder="The account was closed after a payment review. I need to provide ownership proof and transaction context."
                    value={summary}
                  />
                </CaseFormField>

                <CaseFormField
                  description="Optional. Set the date by which the appeal or response should be ready."
                  icon={CalendarDays}
                  label="Deadline"
                >
                  <Input
                    id="deadline"
                    onChange={(event) => setDeadline(event.target.value)}
                    type="date"
                    value={deadline}
                  />
                </CaseFormField>
              </>
            ) : (
              <dl className="divide-y divide-border rounded-md border border-border">
                <ReviewRow label="Case name" value={title.trim()} />
                <ReviewRow label="Case type" value={selectedCaseType?.name ?? caseTypeSlug} />
                <ReviewRow label="Platform" value={platform.trim()} />
                <ReviewRow label="Description" value={summary.trim() || "No description added"} />
                <ReviewRow label="Deadline" value={deadline ? formatInputDate(deadline) : "No deadline set"} />
              </dl>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-border pt-4 sm:flex sm:justify-end">
              <Button disabled={isSubmitting} onClick={handleBack} type="button" variant="ghost">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {step === 1 ? "Cancel" : "Back"}
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {step === 1 ? (
                  <>
                    Continue to review
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {isSubmitting ? "Creating..." : "Create and add evidence"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
          </form>
        </Card>

        <aside className="hidden gap-4 lg:sticky lg:top-24 lg:grid" aria-label="Case setup guidance">
          <Card>
            <CardHeader>
              <CardTitle>Setup checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-3">
                <SetupStep isComplete={Boolean(title.trim() && platform.trim())} label="Case details" />
                <SetupStep isComplete={step === 2} label="Review details" />
                <SetupStep isComplete={false} label="Add evidence" />
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Before you continue</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm leading-6 text-muted-foreground">
              <p className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                Case records and uploaded evidence remain private to your workspace.
              </p>
              <p className="flex items-start gap-3">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                Use the platform name and issue in the case title so it stays easy to find.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}

function SetupStep({ isComplete, label }: { isComplete: boolean; label: string }) {
  const StatusIcon = isComplete ? Check : Circle;

  return (
    <li className="flex items-center gap-3 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
          isComplete
            ? "border-teal-400/30 bg-teal-400/10 text-teal-200"
            : "border-border bg-secondary/35 text-muted-foreground"
        )}
      >
        <StatusIcon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </li>
  );
}

function CaseCreationProgress({ currentStep }: { currentStep: CreateCaseStep }) {
  const steps = [
    { label: "Details", value: 1 },
    { label: "Review", value: 2 },
    { label: "Evidence", value: 3 }
  ] as const;

  return (
    <ol className="grid grid-cols-[auto_minmax(2rem,1fr)_auto_minmax(2rem,1fr)_auto] items-start" aria-label="Case creation progress">
      {steps.map((item, index) => (
        <li key={item.value} className="contents">
          <span className="grid justify-items-center gap-2">
            <span
              aria-current={currentStep === item.value ? "step" : undefined}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold",
                currentStep >= item.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-secondary text-muted-foreground"
              )}
            >
              {item.value}
            </span>
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </span>
          {index < steps.length - 1 ? (
            <span
              className={cn(
                "mt-5 h-px w-full",
                currentStep > item.value ? "bg-primary" : "bg-border"
              )}
              aria-hidden="true"
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function CaseFormField({
  children,
  description,
  icon: Icon,
  label
}: {
  children: ReactNode;
  description: string;
  icon: LucideIcon;
  label: string;
}) {
  const inputId = getFieldId(label);

  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 border-b border-border pb-4 last:border-b-0">
      <span className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="grid gap-2">
        <Label htmlFor={inputId}>{label}</Label>
        {children}
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-4 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm leading-6 text-foreground">{value}</dd>
    </div>
  );
}

function getFieldId(label: string) {
  if (label === "Case name") {
    return "case-title";
  }

  if (label === "Case type") {
    return "case-type";
  }

  if (label === "Short description") {
    return "summary";
  }

  return label.toLowerCase().replaceAll(" ", "-");
}

function formatInputDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}
