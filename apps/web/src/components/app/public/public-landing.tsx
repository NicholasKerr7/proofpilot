import Image from "next/image";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileArchive,
  FileCheck2,
  FolderLock,
  ListChecks,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  type LucideIcon
} from "lucide-react";
import { AuthBrand } from "@/components/app/auth/auth-brand";
import type { AuthMode } from "@/components/app/auth-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PublicLandingProps {
  error: string | null;
  isDemoStarting: boolean;
  onExploreDemo: () => Promise<void>;
  onSelectAuth: (mode: AuthMode) => void;
  portfolioMode: boolean;
}

const productFeatures: Array<{
  description: string;
  icon: LucideIcon;
  title: string;
  tone: string;
}> = [
  {
    description: "Keep notices, screenshots, messages, and records together in one private case.",
    icon: FolderLock,
    title: "Evidence vault",
    tone: "border-sky-400/25 bg-sky-400/10 text-sky-200"
  },
  {
    description: "Turn extracted dates and confirmed events into a chronology reviewers can follow.",
    icon: Clock3,
    title: "Timeline builder",
    tone: "border-primary/35 bg-primary/10 text-primary"
  },
  {
    description: "Find missing proof before exporting a structured, professional appeal packet.",
    icon: FileArchive,
    title: "Packet generator",
    tone: "border-teal-400/25 bg-teal-400/10 text-teal-200"
  }
];

const workflowSteps = [
  {
    description: "Start an account-ban appeal and add the facts a reviewer needs.",
    icon: FileCheck2,
    title: "Create the case"
  },
  {
    description: "Upload records securely and review the generated timeline and checklist.",
    icon: UploadCloud,
    title: "Organize the proof"
  },
  {
    description: "Finalize the statement and download the complete case packet.",
    icon: FileArchive,
    title: "Export with confidence"
  }
] as const;

export function PublicLanding({
  error,
  isDemoStarting,
  onExploreDemo,
  onSelectAuth,
  portfolioMode
}: PublicLandingProps) {
  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <header className="relative z-20 border-b border-border/70 bg-background/90 px-4 backdrop-blur sm:px-6 lg:px-10">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4">
          <AuthBrand />

          <nav aria-label="Public navigation" className="hidden items-center gap-7 lg:flex">
            <a className="text-sm text-muted-foreground hover:text-foreground" href="#features">
              Features
            </a>
            <a className="text-sm text-muted-foreground hover:text-foreground" href="#workflow">
              How it works
            </a>
            <a className="text-sm text-muted-foreground hover:text-foreground" href="#privacy">
              Privacy
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {!portfolioMode ? (
              <Button
                className="hidden sm:inline-flex"
                onClick={() => onSelectAuth("login")}
                type="button"
                variant="outline"
              >
                Sign in
              </Button>
            ) : null}
            <Button
              disabled={isDemoStarting}
              onClick={() => {
                if (portfolioMode) {
                  void onExploreDemo();
                } else {
                  onSelectAuth("register");
                }
              }}
              type="button"
            >
              <span className="hidden sm:inline">
                {portfolioMode
                  ? isDemoStarting
                    ? "Preparing demo..."
                    : "Explore demo"
                  : "Create account"}
              </span>
              <span className="sm:hidden">
                {portfolioMode ? (isDemoStarting ? "Preparing..." : "Explore") : "Get started"}
              </span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <section className="relative px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16 lg:px-10 lg:pb-0 lg:pt-10">
        <Image
          alt=""
          className="pointer-events-none absolute inset-x-0 top-0 h-auto w-full object-cover opacity-35"
          height={736}
          priority
          src="/brand/proofpilot-landing-arc-backdrop.png"
          width={2137}
        />
        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="secondary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {portfolioMode ? "Interactive portfolio demo" : "Account appeal workspace"}
            </Badge>
            <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-normal text-foreground sm:text-5xl">
              ProofPilot Account Appeal Builder
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8 lg:mt-4">
              Turn scattered evidence into a clear timeline, a complete proof checklist, and a
              professional case packet ready for review.
            </p>
            <div
              className={`mx-auto mt-8 grid gap-3 lg:mt-6 ${portfolioMode ? "max-w-sm" : "max-w-xl sm:grid-cols-2"}`}
            >
              <Button
                className="w-full"
                disabled={isDemoStarting}
                onClick={() => {
                  if (portfolioMode) {
                    void onExploreDemo();
                  } else {
                    onSelectAuth("register");
                  }
                }}
                size="lg"
                type="button"
              >
                {portfolioMode
                  ? isDemoStarting
                    ? "Preparing workspace..."
                    : "Explore interactive demo"
                  : "Create account"}
                <ArrowRight className="ml-auto h-4 w-4" aria-hidden="true" />
              </Button>
              {!portfolioMode ? (
                <Button
                  className="w-full"
                  onClick={() => onSelectAuth("login")}
                  size="lg"
                  type="button"
                  variant="outline"
                >
                  Sign in
                </Button>
              ) : null}
            </div>
            {error ? (
              <p
                className="mx-auto mt-4 max-w-xl rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground sm:text-sm lg:mt-4">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                {portfolioMode ? "Isolated sample workspace" : "Private case workspace"}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-300" aria-hidden="true" />
                Guided appeal workflow
              </li>
              <li className="flex items-center gap-2">
                <FileArchive className="h-4 w-4 text-sky-300" aria-hidden="true" />
                {portfolioMode ? "Sample data resets automatically" : "Downloadable PDF packet"}
              </li>
            </ul>
          </div>

          <LandingWorkspacePreview />
        </div>
      </section>

      <section className="border-y border-border bg-card/35 px-4 py-14 sm:px-6 lg:px-10" id="features">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">One organized workspace</p>
            <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
              Build the record before you submit the appeal
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {productFeatures.map((feature) => (
              <article
                className="proof-card-surface grid min-h-56 content-between gap-8 rounded-md border bg-card p-5 sm:p-6"
                key={feature.title}
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-md border ${feature.tone}`}
                >
                  <feature.icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 lg:px-10 lg:py-20" id="workflow">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:items-start">
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-primary">How it works</p>
            <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
              From first upload to final packet
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
              ProofPilot keeps each step connected to the same private case, so evidence,
              timelines, statements, and exports stay consistent.
            </p>
          </div>

          <ol className="border-y border-border">
            {workflowSteps.map((step, index) => (
              <li
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 border-b border-border py-5 last:border-b-0"
                key={step.title}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase text-primary">Step {index + 1}</p>
                  <h3 className="mt-1 font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-border bg-card/35 px-4 py-12 sm:px-6 lg:px-10" id="privacy">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex max-w-2xl items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">
                {portfolioMode ? "Temporary by design" : "Private by design"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {portfolioMode
                  ? "Every visitor receives an isolated sample workspace. Changes are temporary, outbound delivery is disabled, and the workspace is removed automatically."
                  : "Cases are owner-scoped, evidence uses private signed access, and important changes are recorded in the case activity log."}
              </p>
            </div>
          </div>
          <Button
            disabled={isDemoStarting}
            onClick={() => {
              if (portfolioMode) {
                void onExploreDemo();
              } else {
                onSelectAuth("register");
              }
            }}
            type="button"
          >
            {portfolioMode ? "Explore the demo" : "Start a private case"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </section>
    </main>
  );
}

function LandingWorkspacePreview() {
  return (
    <section
      aria-label="ProofPilot case workspace preview"
      className="proof-accent-frame relative mx-auto mt-12 max-w-5xl overflow-hidden rounded-md border bg-card/95 p-4 shadow-2xl sm:p-5 lg:mt-6 lg:max-h-80"
    >
      <div className="grid gap-4 border-b border-border pb-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Primary case</p>
          <h2 className="mt-1 text-lg font-semibold sm:text-xl">
            PayPal account closure appeal
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Case packet in progress</p>
        </div>
        <Badge variant="warning">Needs more evidence</Badge>
      </div>

      <dl className="grid grid-cols-2 border-b border-border py-4 md:grid-cols-4">
        <PreviewMetric label="Evidence" value="12" />
        <PreviewMetric label="Processed" value="9" tone="text-teal-200" />
        <PreviewMetric label="Missing" value="2" tone="text-primary" />
        <PreviewMetric label="Timeline" value="4" tone="text-sky-200" />
      </dl>

      <div className="grid gap-5 pt-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Next actions</h3>
            <span className="text-xs text-primary">3 remaining</span>
          </div>
          <div className="mt-3 grid gap-2">
            <PreviewAction icon={UploadCloud} label="Upload account ownership proof" />
            <PreviewAction icon={ListChecks} label="Review missing evidence" />
            <PreviewAction icon={FileArchive} label="Generate packet preview" />
          </div>
        </div>

        <div className="border-t border-border pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Case readiness</h3>
            <span className="text-lg font-semibold text-primary">68%</span>
          </div>
          <progress aria-label="Case readiness" className="proof-progress mt-3" max={100} value={68} />
          <ul className="mt-4 grid gap-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-teal-300" aria-hidden="true" />
              Timeline reviewed
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-teal-300" aria-hidden="true" />
              Statement draft saved
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              Two proof gaps need attention
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function PreviewMetric({
  label,
  tone = "text-foreground",
  value
}: {
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <div className="border-border px-3 py-2 text-center odd:border-r md:border-r md:last:border-r-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-xl font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}

function PreviewAction({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="text-sm text-foreground">{label}</span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
