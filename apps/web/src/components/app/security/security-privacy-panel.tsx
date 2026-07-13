"use client";

import { useEffect, useState } from "react";
import type {
  SecurityOverview,
  UpdateUserSettingsInput,
  UserSettings
} from "@proofpilot/types";
import { ArrowLeft, LoaderCircle, RefreshCcw, ShieldCheck } from "lucide-react";
import { SecurityAccountControls } from "@/components/app/security/security-account-controls";
import { SecurityPrivacyControls } from "@/components/app/security/security-privacy-controls";
import { SecuritySidebar } from "@/components/app/security/security-sidebar";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/client/api";

interface SecurityPrivacyPanelProps {
  onBack: () => void;
  onOpenHelp: () => void;
  onOpenReports: () => void;
  onUpdateSettings: (input: UpdateUserSettingsInput) => Promise<UserSettings>;
  settings: UserSettings | null;
}

export function SecurityPrivacyPanel({
  onBack,
  onOpenHelp,
  onOpenReports,
  onUpdateSettings,
  settings
}: SecurityPrivacyPanelProps) {
  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      try {
        const nextOverview = await apiRequest<SecurityOverview>("/api/security");

        if (isMounted) {
          setOverview(nextOverview);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error ? loadError.message : "Security details could not be loaded."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  function retry() {
    setIsLoading(true);
    setRefreshKey((current) => current + 1);
  }

  function reviewActivity() {
    const reduceMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.reduceMotion === "true";

    document.getElementById("security-login-activity")?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start"
    });
  }

  return (
    <section aria-labelledby="security-privacy-heading" className="grid gap-5">
      <div className="flex items-start gap-3">
        <Button
          aria-label="Back to More"
          className="mt-0.5 shrink-0"
          onClick={onBack}
          size="icon"
          title="Back to More"
          type="button"
          variant="ghost"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <span className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-md border border-primary/45 bg-primary/10 text-primary sm:flex">
          <ShieldCheck className="h-8 w-8" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-primary">Account protection</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl" id="security-privacy-heading">
            Security &amp; Privacy
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            Manage account protection, login activity, and privacy preferences.
          </p>
        </div>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100" role="alert">
          <span>{error}</span>
          <Button onClick={retry} size="sm" type="button" variant="outline">
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex min-h-48 items-center justify-center gap-3 rounded-md border border-border bg-card text-sm text-muted-foreground">
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
          Loading security details...
        </div>
      ) : null}

      {overview ? (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1.65fr)_minmax(17rem,0.95fr)]">
          <div className="grid content-start gap-3">
            <SecurityAccountControls
              onOpenReports={onOpenReports}
              onPasswordChanged={(passwordChangedAt) => {
                setOverview((current) =>
                  current ? { ...current, passwordChangedAt } : current
                );
              }}
              onReviewActivity={reviewActivity}
              overview={overview}
            />
            <SecurityPrivacyControls
              onOpenHelp={onOpenHelp}
              onUpdate={onUpdateSettings}
              settings={settings}
            />
          </div>
          <SecuritySidebar overview={overview} />
        </div>
      ) : null}
    </section>
  );
}
