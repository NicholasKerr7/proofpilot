"use client";

import { useState } from "react";
import type { HelpArticleSlug } from "@proofpilot/types";
import { ContactSupportForm } from "@/components/app/help/contact-support-form";
import { HelpArticleDetail } from "@/components/app/help/help-article-detail";
import { helpArticlesBySlug } from "@/components/app/help/help-content";
import { HelpHome } from "@/components/app/help/help-home";
import type { CaseRecord } from "@/lib/client/types";

type HelpView =
  | { id: "home" }
  | { id: "article"; articleSlug: HelpArticleSlug }
  | { id: "contact" };

interface HelpCenterPanelProps {
  cases: CaseRecord[];
  initialView?: "home" | "contact";
  onSupportRequestCreated: () => void;
  selectedCaseId: string | null;
}

export function HelpCenterPanel({
  cases,
  initialView = "home",
  onSupportRequestCreated,
  selectedCaseId
}: HelpCenterPanelProps) {
  const [view, setView] = useState<HelpView>({ id: initialView });

  function openArticle(articleSlug: HelpArticleSlug) {
    setView({ id: "article", articleSlug });
    scrollToTop();
  }

  function openHome() {
    setView({ id: "home" });
    scrollToTop();
  }

  function openContact() {
    setView({ id: "contact" });
    scrollToTop();
  }

  if (view.id === "article") {
    const article = helpArticlesBySlug.get(view.articleSlug);

    if (article) {
      return (
        <HelpArticleDetail
          article={article}
          key={article.slug}
          onBack={openHome}
          onContactSupport={openContact}
          onOpenArticle={openArticle}
        />
      );
    }
  }

  if (view.id === "contact") {
    return (
      <ContactSupportForm
        cases={cases}
        initialCaseId={selectedCaseId}
        onBack={openHome}
        onSupportRequestCreated={onSupportRequestCreated}
      />
    );
  }

  return <HelpHome onContactSupport={openContact} onOpenArticle={openArticle} />;
}

function scrollToTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      top: 0
    });
  });
}
