"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ChevronRight, CircleHelp, Search, SlidersHorizontal } from "lucide-react";
import type { HelpArticleSlug } from "@proofpilot/types";
import { HelpFeaturedTopics } from "@/components/app/help/help-featured-topics";
import { helpCategoryIcons } from "@/components/app/help/help-icons";
import {
  helpArticles,
  helpCategories,
  helpCategoriesById,
  type HelpArticle,
  type HelpCategoryId
} from "@/components/app/help/help-content";
import { HelpSupportOptions } from "@/components/app/help/help-support-options";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface HelpHomeProps {
  onContactSupport: () => void;
  onOpenArticle: (articleSlug: HelpArticleSlug) => void;
}

export function HelpHome({ onContactSupport, onOpenArticle }: HelpHomeProps) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<HelpCategoryId | "all">("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const filteredArticles = useMemo(
    () => filterHelpArticles(query, categoryId),
    [categoryId, query]
  );
  const isBrowsing = Boolean(query.trim()) || categoryId !== "all" || showAll;
  const displayedArticles = isBrowsing
    ? filteredArticles
    : helpArticles.filter((article) => article.popular);

  function browseCategory(nextCategoryId: HelpCategoryId) {
    setCategoryId(nextCategoryId);
    setShowAll(true);
    scrollToArticleResults();
  }

  function browseAllArticles() {
    setShowAll(true);
    setCategoryId("all");
    scrollToArticleResults();
  }

  return (
    <section aria-labelledby="help-center-heading" className="grid gap-6">
      <div>
        <p className="text-sm font-semibold text-primary">Guides and support</p>
        <h1 id="help-center-heading" className="mt-1 text-2xl font-semibold sm:text-3xl">
          Help Center
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Find answers for building, reviewing, and exporting an appeal packet.
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search Help Center"
            className="min-h-13 border-primary/40 pl-12"
            onChange={(event) => {
              setQuery(event.target.value);
              setShowAll(Boolean(event.target.value));
            }}
            placeholder="Search articles, topics, or questions"
            type="search"
            value={query}
          />
        </div>
        <Button
          aria-controls="help-category-filter-panel"
          aria-expanded={isFilterOpen}
          aria-label="Filter help articles"
          className="h-13 w-13 md:hidden"
          onClick={() => setIsFilterOpen((current) => !current)}
          size="icon"
          title="Filter topics"
          type="button"
          variant={categoryId === "all" ? "outline" : "secondary"}
        >
          <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
        </Button>
        <div
          className={cn(
            "relative col-span-2",
            isFilterOpen ? "block" : "hidden",
            "md:col-span-1 md:col-start-2 md:row-start-1 md:block"
          )}
          id="help-category-filter-panel"
        >
          <Label className="sr-only" htmlFor="help-category-filter">
            Filter by topic
          </Label>
          <SlidersHorizontal
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-primary"
          />
          <Select
            className="min-h-13 pl-11"
            id="help-category-filter"
            onChange={(event) => {
              setCategoryId(event.target.value as HelpCategoryId | "all");
              setShowAll(event.target.value !== "all");
              setIsFilterOpen(false);
            }}
            value={categoryId}
          >
            <option value="all">All topics</option>
            {helpCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <HelpFeaturedTopics onOpenArticle={onOpenArticle} />

      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase text-primary">
            <span className="md:hidden">Browse by topic</span>
            <span className="hidden md:inline">Browse by category</span>
          </h2>
          <span className="text-xs text-muted-foreground">{helpArticles.length} articles</span>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3">
          {helpCategories.map((category) => {
            const Icon = helpCategoryIcons[category.id];

            return (
              <button
                className="group relative grid min-h-40 content-start gap-3 rounded-md border border-border bg-card p-3 text-left hover:border-primary/50 hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-32 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:content-normal sm:items-center md:min-h-24"
                key={category.id}
                onClick={() => browseCategory(category.id)}
                type="button"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    {category.title}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                    {category.description}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="absolute right-3 top-3 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary sm:static"
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3" id="help-article-results">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase text-primary">
              {isBrowsing ? "Articles" : "Popular articles"}
            </h2>
            <p aria-live="polite" className="mt-1 text-xs text-muted-foreground">
              {isBrowsing
                ? `${displayedArticles.length} ${displayedArticles.length === 1 ? "result" : "results"}`
                : "Frequently used guides"}
            </p>
          </div>
          {!isBrowsing ? (
            <Button
              onClick={() => {
                browseAllArticles();
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              View all articles
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        {displayedArticles.length ? (
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {displayedArticles.map((article, index) => (
                <ArticleDestination
                  article={article}
                  hideOnTablet={!isBrowsing && index >= 4}
                  key={article.slug}
                  onOpen={() => onOpenArticle(article.slug)}
                />
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="grid min-h-48 place-items-center p-6 text-center">
              <div>
                <Search aria-hidden="true" className="mx-auto h-6 w-6 text-primary" />
                <p className="mt-3 text-sm font-semibold">No matching help articles</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try a shorter search or choose another topic.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => {
                    setQuery("");
                    setCategoryId("all");
                    setShowAll(false);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Clear filters
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <HelpSupportOptions
        onBrowseArticles={browseAllArticles}
        onContactSupport={onContactSupport}
        onOpenSecurityGuide={() => onOpenArticle("security-and-privacy")}
      />

      <Card className="border-primary/45 md:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleHelp aria-hidden="true" className="h-5 w-5 text-primary" />
            Still need help?
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Send an authenticated support request and optionally link the case that needs review.
          </p>
          <Button className="shrink-0" onClick={onContactSupport} type="button" variant="outline">
            Contact support
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

function ArticleDestination({
  article,
  hideOnTablet,
  onOpen
}: {
  article: HelpArticle;
  hideOnTablet: boolean;
  onOpen: () => void;
}) {
  const category = helpCategoriesById.get(article.categoryId);
  const Icon = helpCategoryIcons[article.categoryId];

  return (
    <button
      className={cn(
        "group grid min-h-20 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 text-left hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-4",
        hideOnTablet ? "md:hidden lg:grid" : null
      )}
      onClick={onOpen}
      type="button"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block break-words text-sm font-semibold text-foreground">{article.title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {article.summary}
        </span>
        <span className="mt-1 block text-[11px] text-primary">{category?.title}</span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary"
      />
    </button>
  );
}

function scrollToArticleResults() {
  window.requestAnimationFrame(() => {
    document.getElementById("help-article-results")?.scrollIntoView({
      behavior:
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        document.documentElement.dataset.reduceMotion === "true"
          ? "auto"
          : "smooth",
      block: "start"
    });
  });
}

function filterHelpArticles(query: string, categoryId: HelpCategoryId | "all") {
  const normalizedQuery = query.trim().toLowerCase();

  return helpArticles.filter((article) => {
    if (categoryId !== "all" && article.categoryId !== categoryId) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const category = helpCategoriesById.get(article.categoryId);
    const searchableText = [
      article.title,
      article.summary,
      article.intro,
      category?.title,
      ...article.sections.flatMap((section) => [
        section.heading,
        ...(section.paragraphs ?? []),
        ...(section.steps?.flatMap((step) => [step.title, step.detail]) ?? [])
      ])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });
}
