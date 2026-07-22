"use client";

import { useState, type KeyboardEvent } from "react";
import type { GmailImportItem } from "@proofpilot/types";
import { CloudDownload, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { formatEvidenceBytes } from "@/components/app/evidence/evidence-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTabKeyboardTarget } from "@/lib/tab-keyboard-navigation";
import { cn } from "@/lib/utils";

interface GmailImportBrowserProps {
  isImporting: boolean;
  items: GmailImportItem[];
  onImport: (itemIds: string[]) => Promise<void>;
}

type GmailFilter = "ALL" | "SELECTED" | "UNREAD";

const gmailFilters: readonly GmailFilter[] = ["ALL", "SELECTED", "UNREAD"];

export function GmailImportBrowser({
  isImporting,
  items,
  onImport
}: GmailImportBrowserProps) {
  const [activeFilter, setActiveFilter] = useState<GmailFilter>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(items.slice(0, 4).map((item) => item.id))
  );
  const selectedItems = items.filter((item) => selectedIds.has(item.id));
  const filteredItems = items.filter((item) => {
    if (activeFilter === "SELECTED") {
      return selectedIds.has(item.id);
    }

    return activeFilter !== "UNREAD" || item.unread;
  });
  const counts = {
    ALL: items.length,
    SELECTED: selectedItems.length,
    UNREAD: items.filter((item) => item.unread).length
  } satisfies Record<GmailFilter, number>;

  function toggleItem(itemId: string) {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(itemId)) {
        nextIds.delete(itemId);
      } else {
        nextIds.add(itemId);
      }

      return nextIds;
    });
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentFilter: GmailFilter
  ) {
    const nextFilter = getTabKeyboardTarget(gmailFilters, currentFilter, event.key);

    if (!nextFilter) {
      return;
    }

    event.preventDefault();
    setActiveFilter(nextFilter);
    document.getElementById(getGmailFilterId(nextFilter))?.focus();
  }

  return (
    <div className="grid gap-4">
      <div
        aria-label="Email filters"
        className="grid grid-cols-3 rounded-md border border-border bg-card p-1"
        role="tablist"
      >
        {gmailFilters.map((filter) => (
          <button
            aria-controls="gmail-email-list"
            aria-selected={activeFilter === filter}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-md px-2 text-xs font-semibold text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
              activeFilter === filter
                ? "border border-primary/55 bg-primary/10 text-primary"
                : "hover:bg-secondary/50 hover:text-foreground"
            )}
            id={getGmailFilterId(filter)}
            key={filter}
            onClick={() => setActiveFilter(filter)}
            onKeyDown={(event) => handleTabKeyDown(event, filter)}
            role="tab"
            tabIndex={activeFilter === filter ? 0 : -1}
            type="button"
          >
            {formatFilterLabel(filter)}
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-foreground">
              {counts[filter]}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem] md:items-start">
        <section
          aria-labelledby="gmail-email-list-heading"
          className="proof-card-surface min-w-0 overflow-hidden rounded-md border"
        >
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold" id="gmail-email-list-heading">
              Select emails to import
            </h2>
            <span className="text-xs text-muted-foreground">
              {filteredItems.length} {filteredItems.length === 1 ? "email" : "emails"} shown
            </span>
          </header>
          <div id="gmail-email-list" role="tabpanel" aria-live="polite">
            {filteredItems.length ? (
              <ul className="divide-y divide-border">
                {filteredItems.map((item) => (
                  <GmailImportRow
                    checked={selectedIds.has(item.id)}
                    item={item}
                    key={item.id}
                    onToggle={() => toggleItem(item.id)}
                  />
                ))}
              </ul>
            ) : (
              <div className="grid min-h-40 place-items-center p-5 text-center">
                <div>
                  <Mail className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No emails match this filter.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <GmailImportSummary
          isImporting={isImporting}
          items={selectedItems}
          onImport={() => onImport(selectedItems.map((item) => item.id))}
        />
      </div>
    </div>
  );
}

function GmailImportRow({
  checked,
  item,
  onToggle
}: {
  checked: boolean;
  item: GmailImportItem;
  onToggle: () => void;
}) {
  return (
    <li>
      <label className="grid cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)] gap-3 px-4 py-4 transition-colors hover:bg-secondary/25 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto]">
        <input
          aria-label={`Select ${item.subject}`}
          checked={checked}
          className="mt-3 h-5 w-5 shrink-0 accent-primary"
          onChange={onToggle}
          type="checkbox"
        />
        <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">
          {getSenderInitials(item)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs text-muted-foreground">
            {item.senderAddress}
          </span>
          <span className="mt-1 block break-words text-sm font-semibold text-foreground">
            {item.subject}
          </span>
          <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
            {item.preview}
          </span>
        </span>
        <span className="col-start-3 flex items-center gap-2 self-start text-xs text-muted-foreground sm:col-start-4 sm:row-start-1">
          {formatEmailDate(item.receivedAt)}
          {item.unread ? (
            <>
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              <span className="sr-only">Unread</span>
            </>
          ) : null}
        </span>
      </label>
    </li>
  );
}

function GmailImportSummary({
  isImporting,
  items,
  onImport
}: {
  isImporting: boolean;
  items: GmailImportItem[];
  onImport: () => Promise<void>;
}) {
  const totalSize = items.reduce((total, item) => total + item.sizeBytes, 0);
  const senderCount = new Set(items.map((item) => item.senderAddress)).size;
  const dateRange = formatEmailDateRange(items);

  return (
    <aside className="proof-accent-frame rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-primary">Import summary</h2>
          <p className="mt-2 text-lg font-semibold">
            {items.length} {items.length === 1 ? "email" : "emails"} selected
          </p>
        </div>
        <Badge variant="secondary">{formatEvidenceBytes(totalSize)}</Badge>
      </div>

      <p className="mt-1 text-xs text-muted-foreground md:hidden">
        These will be imported as evidence.
      </p>

      <dl className="mt-4 hidden grid-cols-1 gap-3 border-b border-border pb-4 text-sm md:grid">
        <div>
          <dt className="text-xs text-muted-foreground">Date range</dt>
          <dd className="mt-1 font-medium">{dateRange}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">From</dt>
          <dd className="mt-1 font-medium">
            {senderCount} {senderCount === 1 ? "sender" : "senders"}
          </dd>
        </div>
      </dl>

      {items.length ? (
        <ul className="my-4 hidden max-h-52 space-y-3 overflow-y-auto md:block">
          {items.map((item) => (
            <li className="min-w-0 text-xs" key={item.id}>
              <p className="truncate font-semibold text-foreground">{item.subject}</p>
              <p className="mt-0.5 truncate text-muted-foreground">{item.senderAddress}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="my-4 text-sm text-muted-foreground">Choose at least one email.</p>
      )}

      <Button
        className="w-full"
        disabled={!items.length || isImporting}
        onClick={() => void onImport()}
        type="button"
      >
        {isImporting ? (
          <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <CloudDownload className="h-4 w-4" aria-hidden="true" />
        )}
        {isImporting ? "Importing..." : `Import ${items.length || "selected"}`}
      </Button>
      <p className="mt-3 flex items-start justify-center gap-2 text-center text-[11px] leading-4 text-muted-foreground">
        <LockKeyhole className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        Imported securely into this case only.
      </p>
    </aside>
  );
}

function getGmailFilterId(filter: GmailFilter) {
  return `gmail-filter-${filter.toLowerCase()}`;
}

function formatFilterLabel(filter: GmailFilter) {
  if (filter === "ALL") {
    return "All emails";
  }

  return filter.charAt(0) + filter.slice(1).toLowerCase();
}

function getSenderInitials(item: GmailImportItem) {
  const source = item.senderName || item.senderAddress;
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatEmailDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  }).format(new Date(value));
}

function formatEmailDateRange(items: GmailImportItem[]) {
  if (!items.length) {
    return "None";
  }

  const dates = items.map((item) => new Date(item.receivedAt).getTime()).sort((a, b) => a - b);
  const first = formatEmailDate(new Date(dates[0] ?? 0).toISOString());
  const last = formatEmailDate(new Date(dates.at(-1) ?? 0).toISOString());
  return first === last ? first : `${first} - ${last}`;
}
