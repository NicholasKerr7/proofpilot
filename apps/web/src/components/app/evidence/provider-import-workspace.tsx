"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type {
  GmailImportItem,
  GoogleDriveImportItem,
  ProviderImportCatalog,
  ProviderImportProvider,
  ProviderImportResponse
} from "@proofpilot/types";
import { ArrowLeft, CheckCircle2, LoaderCircle, LockKeyhole } from "lucide-react";
import { EvidenceImportHero } from "@/components/app/evidence/evidence-import-hero";
import { GmailImportBrowser } from "@/components/app/evidence/gmail-import-browser";
import { GoogleDriveImportBrowser } from "@/components/app/evidence/google-drive-import-browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/client/api";
import type { CaseRecord } from "@/lib/client/types";

interface ProviderImportWorkspaceProps {
  caseRecord: CaseRecord;
  onBack: () => void;
  onImported: (response: ProviderImportResponse) => Promise<void>;
  provider: ProviderImportProvider;
}

const providerConfig = {
  GMAIL: {
    connectedTitle: "Connected Gmail account",
    logo: "/integrations/gmail.svg",
    subtitle: "Select relevant emails and attach them as evidence to your case.",
    title: "Gmail import"
  },
  GOOGLE_DRIVE: {
    connectedTitle: "Google Drive",
    logo: "/integrations/google-drive.svg",
    subtitle: "Select files from Google Drive to attach to your case.",
    title: "Google Drive import"
  }
} satisfies Record<
  ProviderImportProvider,
  { connectedTitle: string; logo: string; subtitle: string; title: string }
>;

export function ProviderImportWorkspace({
  caseRecord,
  onBack,
  onImported,
  provider
}: ProviderImportWorkspaceProps) {
  const config = providerConfig[provider];
  const [catalog, setCatalog] = useState<ProviderImportCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiRequest<ProviderImportCatalog>(
          `/api/cases/${caseRecord.id}/provider-imports/${provider}`
        );

        if (isMounted) {
          setCatalog(response);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : `${config.title} could not be loaded.`
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      isMounted = false;
    };
  }, [caseRecord.id, config.title, provider]);

  async function importItems(itemIds: string[]) {
    if (!itemIds.length || isImporting) {
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const response = await apiRequest<ProviderImportResponse>(
        `/api/cases/${caseRecord.id}/provider-imports/${provider}`,
        {
          body: JSON.stringify({ itemIds }),
          method: "POST"
        }
      );
      await onImported(response);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Selected evidence could not be imported."
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section aria-labelledby="provider-import-heading" className="grid gap-5">
      <header className="flex items-start gap-3">
        <Button
          aria-label="Back to evidence sources"
          className="shrink-0"
          onClick={onBack}
          size="icon"
          title="Back to evidence sources"
          type="button"
          variant="ghost"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div className="min-w-0">
          <h1
            className="scroll-mt-28 text-2xl font-semibold leading-8 sm:text-3xl"
            id="provider-import-heading"
            tabIndex={-1}
          >
            {config.title}
          </h1>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{config.subtitle}</p>
        </div>
      </header>

      <EvidenceImportHero caseRecord={caseRecord} />

      {isLoading ? <ProviderImportLoading label={config.title} /> : null}

      {catalog ? (
        <>
          <ProviderConnectionBanner catalog={catalog} />
          {error ? <ProviderImportError message={error} /> : null}
          {provider === "GMAIL" ? (
            <GmailImportBrowser
              isImporting={isImporting}
              items={catalog.items.filter(
                (item): item is GmailImportItem => item.kind === "EMAIL"
              )}
              onImport={importItems}
            />
          ) : (
            <GoogleDriveImportBrowser
              isImporting={isImporting}
              items={catalog.items.filter(
                (item): item is GoogleDriveImportItem =>
                  item.kind === "FILE" || item.kind === "FOLDER"
              )}
              onImport={importItems}
            />
          )}
        </>
      ) : null}

      {!isLoading && !catalog ? (
        <div className="proof-card-surface rounded-md border border-red-400/30 p-5" role="alert">
          <h2 className="text-base font-semibold text-red-100">Connection unavailable</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {error ?? `${config.title} could not be loaded.`}
          </p>
          <Button className="mt-4" onClick={onBack} type="button" variant="outline">
            Back to sources
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function ProviderConnectionBanner({ catalog }: { catalog: ProviderImportCatalog }) {
  const config = providerConfig[catalog.provider];

  return (
    <section
      aria-label={`${config.connectedTitle} connection`}
      className="proof-card-surface grid gap-4 rounded-md border p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-5"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-secondary/40">
        <Image alt="" className="h-10 w-10" height={40} src={config.logo} width={40} />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold sm:text-lg">{config.connectedTitle}</h2>
          <Badge variant="success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Connected
          </Badge>
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {catalog.connection.accountLabel}
        </p>
        <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Demo source. Only selected {catalog.provider === "GMAIL" ? "messages" : "files"}
            {" "}are copied into this private case.
          </span>
        </p>
      </div>
      <Badge className="justify-self-start sm:justify-self-end" variant="secondary">
        Demo data
      </Badge>
    </section>
  );
}

function ProviderImportLoading({ label }: { label: string }) {
  return (
    <div
      aria-live="polite"
      className="proof-card-surface grid min-h-48 place-items-center rounded-md border p-6 text-center"
    >
      <div>
        <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-primary motion-reduce:animate-none" />
        <p className="mt-3 text-sm text-muted-foreground">Loading {label.toLowerCase()}...</p>
      </div>
    </div>
  );
}

function ProviderImportError({ message }: { message: string }) {
  return (
    <p
      className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100"
      role="alert"
    >
      {message}
    </p>
  );
}
