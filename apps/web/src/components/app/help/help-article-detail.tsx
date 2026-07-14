"use client";

import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileCheck2,
  Lightbulb,
  ThumbsDown,
  ThumbsUp
} from "lucide-react";
import type { HelpArticleSlug } from "@proofpilot/types";
import { helpCategoryIcons } from "@/components/app/help/help-icons";
import {
  helpArticlesBySlug,
  helpCategoriesById,
  type HelpArticle
} from "@/components/app/help/help-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/client/api";

interface HelpArticleDetailProps {
  article: HelpArticle;
  onBack: () => void;
  onContactSupport: () => void;
  onOpenArticle: (articleSlug: HelpArticleSlug) => void;
}

const successTips = [
  {
    detail: "Confirm every required section and supporting record is present.",
    title: "Be complete"
  },
  {
    detail: "Keep names, dates, and explanations grounded in the source files.",
    title: "Be clear and factual"
  },
  {
    detail: "Review the finished work before exporting or submitting it.",
    title: "Review before acting"
  }
] as const;

export function HelpArticleDetail({
  article,
  onBack,
  onContactSupport,
  onOpenArticle
}: HelpArticleDetailProps) {
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const category = helpCategoriesById.get(article.categoryId);
  const Icon = helpCategoryIcons[article.categoryId];
  const relatedArticles = article.related.flatMap((slug) => {
    const relatedArticle = helpArticlesBySlug.get(slug);
    return relatedArticle ? [relatedArticle] : [];
  });

  async function recordFeedback(helpful: boolean) {
    setIsSubmittingFeedback(true);
    setFeedbackError(null);

    try {
      await apiRequest("/api/support/article-feedback", {
        body: JSON.stringify({ articleSlug: article.slug, helpful }),
        method: "POST"
      });
      setFeedback(helpful);
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : "Feedback could not be recorded.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  return (
    <section aria-labelledby="help-article-heading" className="grid gap-5">
      <Button className="w-fit" onClick={onBack} type="button" variant="ghost">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to Help Center
      </Button>

      <Card className="border-primary/45">
        <CardContent className="grid gap-5 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center md:grid-cols-[minmax(0,1fr)_10rem] md:p-7">
          <span className="flex h-16 w-16 items-center justify-center rounded-md border border-primary/45 bg-primary/10 text-primary md:hidden">
            <Icon aria-hidden="true" className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <Badge className="md:hidden" variant="secondary">
              {category?.title ?? "Help Center"}
            </Badge>
            <div className="hidden items-center gap-2 text-sm font-semibold uppercase text-primary md:flex">
              <BookOpen aria-hidden="true" className="h-5 w-5" />
              <span>Help Center</span>
              {category ? (
                <>
                  <span aria-hidden="true" className="text-border">
                    /
                  </span>
                  <span className="normal-case text-muted-foreground">{category.title}</span>
                </>
              ) : null}
            </div>
            <h1
              className="mt-3 break-words text-2xl font-semibold sm:text-3xl"
              id="help-article-heading"
            >
              {article.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              {article.summary}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <CalendarDays aria-hidden="true" className="h-4 w-4 text-primary" />
                Updated {formatArticleDate(article.updatedAt)}
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock3 aria-hidden="true" className="h-4 w-4 text-primary" />
                {article.readMinutes} min read
              </span>
            </div>
          </div>
          <span className="hidden min-h-36 place-items-center border-l border-border text-primary md:grid">
            <FileCheck2 aria-hidden="true" className="h-24 w-24" strokeWidth={1.25} />
          </span>
        </CardContent>
      </Card>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.75fr)] md:items-start">
        <Card>
          <CardContent className="grid gap-7 p-5 md:p-7">
            <p className="text-sm leading-7 text-muted-foreground">{article.intro}</p>

            {article.sections.map((section) => (
              <section className="grid gap-4 border-t border-border pt-6" key={section.heading}>
                <h2 className="text-lg font-semibold text-foreground">{section.heading}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p className="text-sm leading-7 text-muted-foreground" key={paragraph}>
                    {paragraph}
                  </p>
                ))}
                {section.steps ? (
                  <ol className="grid gap-5 md:gap-0">
                    {section.steps.map((step, index) => (
                      <li
                        className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 md:block md:border-b md:border-border md:py-5 md:first:pt-0 md:last:border-b-0 md:last:pb-0"
                        key={step.title}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/45 bg-primary/10 text-sm font-semibold text-primary md:hidden">
                          {index + 1}
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground md:text-base">
                            <span className="hidden md:inline">{index + 1}. </span>
                            {step.title}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </section>
            ))}

            {article.tip ? (
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-md border border-primary/35 bg-primary/10 p-4">
                <Lightbulb aria-hidden="true" className="mt-0.5 h-5 w-5 text-primary" />
                <p className="text-sm leading-6 text-muted-foreground">
                  <strong className="text-primary">Tip:</strong> {article.tip}
                </p>
              </div>
            ) : null}

            <div className="grid gap-3 border-t border-border pt-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <p className="text-sm font-semibold text-foreground">Was this article helpful?</p>
                {feedback !== null ? (
                  <p className="mt-1 text-xs text-teal-200" role="status">
                    Feedback recorded. Thank you.
                  </p>
                ) : feedbackError ? (
                  <p className="mt-1 text-xs text-red-200" role="alert">
                    {feedbackError}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  aria-pressed={feedback === true}
                  disabled={isSubmittingFeedback}
                  onClick={() => void recordFeedback(true)}
                  size="sm"
                  type="button"
                  variant={feedback === true ? "secondary" : "outline"}
                >
                  <ThumbsUp aria-hidden="true" className="h-4 w-4" />
                  Yes
                </Button>
                <Button
                  aria-pressed={feedback === false}
                  disabled={isSubmittingFeedback}
                  onClick={() => void recordFeedback(false)}
                  size="sm"
                  type="button"
                  variant={feedback === false ? "secondary" : "outline"}
                >
                  <ThumbsDown aria-hidden="true" className="h-4 w-4" />
                  No
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <aside className="grid gap-4" aria-label="Related help">
          <Card>
            <CardHeader>
              <CardTitle className="md:text-sm md:uppercase md:text-primary">
                Tips for success
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {successTips.map((tip) => (
                <div
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-4 text-sm"
                  key={tip.title}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-semibold text-foreground">{tip.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {tip.detail}
                    </span>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Related articles</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {relatedArticles.map((relatedArticle) => (
                <button
                  className="group grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  key={relatedArticle.slug}
                  onClick={() => onOpenArticle(relatedArticle.slug)}
                  type="button"
                >
                  <span>{relatedArticle.title}</span>
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 text-muted-foreground group-hover:text-primary"
                  />
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-primary/45">
            <CardContent className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary">
                <CircleHelp aria-hidden="true" className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Still need help?</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Send a secure request with the relevant case selected.
                </p>
              </div>
              <Button
                className="col-span-2 md:col-span-1 md:col-start-2 md:w-fit"
                onClick={onContactSupport}
                size="sm"
                type="button"
                variant="outline"
              >
                Contact support
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}

function formatArticleDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00.000Z`));
}
