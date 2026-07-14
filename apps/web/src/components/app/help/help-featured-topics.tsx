import { ArrowRight } from "lucide-react";
import type { HelpArticleSlug } from "@proofpilot/types";
import { helpCategoryIcons } from "@/components/app/help/help-icons";
import type { HelpCategoryId } from "@/components/app/help/help-content";

const featuredTopics = [
  {
    articleSlug: "getting-started",
    categoryId: "getting-started",
    description: "New to ProofPilot? Start with the core workflow.",
    title: "Getting started"
  },
  {
    articleSlug: "upload-evidence",
    categoryId: "cases-evidence",
    description: "Upload, review, and organize the records for your appeal.",
    title: "Upload & evidence"
  },
  {
    articleSlug: "build-appeal-statement",
    categoryId: "statements-packets",
    description: "Turn confirmed facts into a clear appeal statement.",
    title: "Build your case"
  },
  {
    articleSlug: "review-process",
    categoryId: "submission-review",
    description: "Prepare the submission and track platform responses.",
    title: "Submit & track"
  }
] satisfies Array<{
  articleSlug: HelpArticleSlug;
  categoryId: HelpCategoryId;
  description: string;
  title: string;
}>;

interface HelpFeaturedTopicsProps {
  onOpenArticle: (articleSlug: HelpArticleSlug) => void;
}

export function HelpFeaturedTopics({ onOpenArticle }: HelpFeaturedTopicsProps) {
  return (
    <section aria-labelledby="featured-help-topics" className="hidden gap-3 md:grid">
      <h2 id="featured-help-topics" className="text-sm font-semibold uppercase text-primary">
        Featured topics
      </h2>
      <div className="grid grid-cols-4 gap-3">
        {featuredTopics.map((topic) => {
          const Icon = helpCategoryIcons[topic.categoryId];

          return (
            <button
              className="group grid min-h-40 content-between gap-4 rounded-md border border-border bg-card p-4 text-left hover:border-primary/50 hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              key={topic.articleSlug}
              onClick={() => onOpenArticle(topic.articleSlug)}
              type="button"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">{topic.title}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {topic.description}
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="ml-auto mt-2 h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
