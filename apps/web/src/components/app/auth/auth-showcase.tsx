import { FileCheck2, FileSearch, ListChecks, ShieldCheck } from "lucide-react";
import { AuthBrand } from "@/components/app/auth/auth-brand";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const workflowStages = [
  {
    description: "Bring screenshots, PDFs, email exports, and notes into one private case.",
    icon: FileSearch,
    label: "Organize evidence",
    tone: "border-primary/30 bg-primary/10 text-primary"
  },
  {
    description: "Review the timeline and resolve the proof gaps that weaken an appeal.",
    icon: ListChecks,
    label: "Strengthen the case",
    tone: "border-sky-400/25 bg-sky-400/10 text-sky-200"
  },
  {
    description: "Prepare a structured statement and downloadable appeal packet.",
    icon: FileCheck2,
    label: "Export the packet",
    tone: "border-teal-400/25 bg-teal-400/10 text-teal-200"
  }
] as const;

export function AuthShowcase() {
  return (
    <section
      aria-labelledby="auth-showcase-heading"
      className="hidden min-h-[42rem] content-between gap-10 border-r border-border pr-12 lg:grid"
    >
      <AuthBrand />

      <div className="max-w-xl self-center">
        <Badge variant="secondary">Account Appeal Builder</Badge>
        <h2
          className="mt-5 text-4xl font-semibold leading-tight tracking-normal text-foreground xl:text-5xl"
          id="auth-showcase-heading"
        >
          Turn scattered evidence into a clear appeal packet.
        </h2>
        <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
          Keep the documents, timeline, missing-proof checklist, statement, and final export in one
          focused workspace.
        </p>

        <ol className="mt-8 border-y border-border">
          {workflowStages.map((stage, index) => (
            <li
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 border-b border-border py-4 last:border-b-0"
              key={stage.label}
            >
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-md border",
                  stage.tone
                )}
              >
                <stage.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-foreground">
                  {index + 1}. {stage.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{stage.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="h-4 w-4 text-primary" />
        Private cases with signed evidence access.
      </p>
    </section>
  );
}
