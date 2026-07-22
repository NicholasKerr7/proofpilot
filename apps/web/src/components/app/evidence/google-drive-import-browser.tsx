"use client";

import { useMemo, useState } from "react";
import type { GoogleDriveImportItem } from "@proofpilot/types";
import {
  CloudUpload,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  LoaderCircle,
  LockKeyhole,
  Search
} from "lucide-react";
import { formatEvidenceBytes } from "@/components/app/evidence/evidence-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GoogleDriveImportBrowserProps {
  isImporting: boolean;
  items: GoogleDriveImportItem[];
  onImport: (itemIds: string[]) => Promise<void>;
}

type DriveFileType = "ALL" | "CSV" | "DOCUMENT" | "IMAGE" | "PDF";
type DriveSort = "MODIFIED" | "NAME" | "SIZE";

export function GoogleDriveImportBrowser({
  isImporting,
  items,
  onImport
}: GoogleDriveImportBrowserProps) {
  const selectableItems = items.filter((item) => item.kind === "FILE");
  const [query, setQuery] = useState("");
  const [fileType, setFileType] = useState<DriveFileType>("ALL");
  const [sort, setSort] = useState<DriveSort>("MODIFIED");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(selectableItems.slice(0, 3).map((item) => item.id))
  );
  const visibleItems = useMemo(
    () => filterAndSortDriveItems(items, query, fileType, sort),
    [fileType, items, query, sort]
  );
  const visibleFiles = visibleItems.filter((item) => item.kind === "FILE");
  const selectedItems = selectableItems.filter((item) => selectedIds.has(item.id));
  const totalSize = selectedItems.reduce((total, item) => total + (item.sizeBytes ?? 0), 0);
  const allVisibleSelected =
    visibleFiles.length > 0 && visibleFiles.every((item) => selectedIds.has(item.id));

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

  function toggleVisibleItems() {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);

      visibleFiles.forEach((item) => {
        if (allVisibleSelected) {
          nextIds.delete(item.id);
        } else {
          nextIds.add(item.id);
        }
      });

      return nextIds;
    });
  }

  return (
    <section
      aria-labelledby="drive-browser-heading"
      className="proof-card-surface min-w-0 overflow-hidden rounded-md border"
    >
      <header className="hidden gap-4 border-b border-border p-5 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold" id="drive-browser-heading">
              Google Drive
            </h2>
            <Badge variant="secondary">
              {selectedItems.length} selected
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse demo Drive metadata and attach selected files to this case.
          </p>
        </div>
        <Button
          className="hidden md:inline-flex"
          disabled={!selectedItems.length || isImporting}
          onClick={() => void onImport(selectedItems.map((item) => item.id))}
          type="button"
        >
          {isImporting ? (
            <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <CloudUpload className="h-4 w-4" aria-hidden="true" />
          )}
          {isImporting ? "Attaching..." : "Attach to case"}
        </Button>
      </header>

      <div className="grid gap-3 border-b border-border p-4 md:grid-cols-[minmax(0,1fr)_12rem_12rem] md:p-5">
        <label className="relative block">
          <span className="sr-only">Search Google Drive files</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            className="h-12 w-full rounded-md border border-border bg-background pl-10 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search in Google Drive"
            type="search"
            value={query}
          />
        </label>
        <label>
          <span className="sr-only">Filter by file type</span>
          <select
            className="h-12 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring"
            onChange={(event) => setFileType(event.target.value as DriveFileType)}
            value={fileType}
          >
            <option value="ALL">All file types</option>
            <option value="PDF">PDF</option>
            <option value="IMAGE">Images</option>
            <option value="CSV">CSV</option>
            <option value="DOCUMENT">Documents</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Sort Google Drive files</span>
          <select
            className="h-12 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring"
            onChange={(event) => setSort(event.target.value as DriveSort)}
            value={sort}
          >
            <option value="MODIFIED">Last modified</option>
            <option value="NAME">Name</option>
            <option value="SIZE">Size</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-5">
        <p className="text-sm font-semibold text-primary">
          {selectedItems.length} {selectedItems.length === 1 ? "file" : "files"} selected
          <span className="ml-2 font-normal text-muted-foreground">
            {formatEvidenceBytes(totalSize)}
          </span>
        </p>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
          <span>{allVisibleSelected ? "Clear visible" : "Select all visible"}</span>
          <input
            checked={allVisibleSelected}
            className="h-5 w-5 accent-primary"
            disabled={!visibleFiles.length}
            onChange={toggleVisibleItems}
            type="checkbox"
          />
        </label>
      </div>

      <div className="hidden grid-cols-[2.75rem_minmax(0,1fr)_10rem_7rem] gap-3 border-b border-border px-5 py-3 text-xs font-semibold text-muted-foreground sm:grid">
        <span aria-hidden="true" />
        <span>Name</span>
        <span>Modified</span>
        <span>Size</span>
      </div>

      {visibleItems.length ? (
        <ul className="divide-y divide-border">
          {visibleItems.map((item) => (
            <GoogleDriveImportRow
              checked={selectedIds.has(item.id)}
              item={item}
              key={item.id}
              onToggle={() => toggleItem(item.id)}
            />
          ))}
        </ul>
      ) : (
        <div className="grid min-h-44 place-items-center p-6 text-center">
          <div>
            <Search className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold">No files found</p>
            <p className="mt-1 text-xs text-muted-foreground">Try a different search or filter.</p>
          </div>
        </div>
      )}

      <footer className="grid gap-3 border-t border-border p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-5">
        <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Files are read from the demo source and copied only after you attach them.
        </p>
        <Button
          className="w-full md:hidden"
          disabled={!selectedItems.length || isImporting}
          onClick={() => void onImport(selectedItems.map((item) => item.id))}
          type="button"
        >
          {isImporting ? (
            <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <CloudUpload className="h-4 w-4" aria-hidden="true" />
          )}
          {isImporting
            ? "Attaching..."
            : `Attach selected files (${selectedItems.length})`}
        </Button>
      </footer>
    </section>
  );
}

function GoogleDriveImportRow({
  checked,
  item,
  onToggle
}: {
  checked: boolean;
  item: GoogleDriveImportItem;
  onToggle: () => void;
}) {
  const isFolder = item.kind === "FOLDER";

  return (
    <li
      className={cn(
        "grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-4 sm:grid-cols-[2.75rem_minmax(0,1fr)_10rem_7rem] sm:items-center sm:px-5",
        checked ? "bg-primary/[0.035]" : null
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center sm:h-auto sm:w-auto">
        {isFolder ? (
          <span className="h-5 w-5" aria-hidden="true" />
        ) : (
          <input
            aria-label={`Select ${item.name}`}
            checked={checked}
            className="h-5 w-5 accent-primary"
            onChange={onToggle}
            type="checkbox"
          />
        )}
      </span>
      <div className="flex min-w-0 items-center gap-3">
        <DriveFileIcon item={item} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground" title={item.name}>
            {item.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDriveType(item)}</p>
          <p className="mt-1 text-xs text-muted-foreground sm:hidden">
            Modified {formatDriveDate(item.modifiedAt)}
            {item.sizeBytes ? ` · ${formatEvidenceBytes(item.sizeBytes)}` : ""}
          </p>
        </div>
      </div>
      <div className="hidden text-xs text-muted-foreground sm:block">
        <p>{formatDriveDate(item.modifiedAt)}</p>
        <p className="mt-1">{item.ownerLabel}</p>
      </div>
      <p className="hidden text-xs text-muted-foreground sm:block">
        {item.sizeBytes ? formatEvidenceBytes(item.sizeBytes) : "-"}
      </p>
    </li>
  );
}

function DriveFileIcon({ item }: { item: GoogleDriveImportItem }) {
  if (item.kind === "FOLDER") {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-amber-400/25 bg-amber-400/10 text-amber-300">
        <Folder className="h-6 w-6" aria-hidden="true" />
      </span>
    );
  }

  if (item.mimeType === "application/pdf") {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-red-400/25 bg-red-400/10 text-red-300">
        <FileText className="h-6 w-6" aria-hidden="true" />
      </span>
    );
  }

  if (item.mimeType?.startsWith("image/")) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
        <FileImage className="h-6 w-6" aria-hidden="true" />
      </span>
    );
  }

  if (item.mimeType === "text/csv") {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-lime-400/25 bg-lime-400/10 text-lime-300">
        <FileSpreadsheet className="h-6 w-6" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-blue-400/25 bg-blue-400/10 text-blue-300">
      <File className="h-6 w-6" aria-hidden="true" />
    </span>
  );
}

function filterAndSortDriveItems(
  items: GoogleDriveImportItem[],
  query: string,
  fileType: DriveFileType,
  sort: DriveSort
) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesQuery = !normalizedQuery || item.name.toLowerCase().includes(normalizedQuery);
    const matchesType =
      fileType === "ALL" ||
      (fileType === "PDF" && item.mimeType === "application/pdf") ||
      (fileType === "IMAGE" && item.mimeType?.startsWith("image/")) ||
      (fileType === "CSV" && item.mimeType === "text/csv") ||
      (fileType === "DOCUMENT" && item.mimeType?.includes("wordprocessingml"));
    return matchesQuery && matchesType;
  });

  return [...filteredItems].sort((left, right) => {
    if (sort === "NAME") {
      return left.name.localeCompare(right.name);
    }

    if (sort === "SIZE") {
      return (right.sizeBytes ?? -1) - (left.sizeBytes ?? -1);
    }

    return new Date(right.modifiedAt).getTime() - new Date(left.modifiedAt).getTime();
  });
}

function formatDriveType(item: GoogleDriveImportItem) {
  if (item.kind === "FOLDER") {
    return "Folder";
  }

  if (item.mimeType === "application/pdf") {
    return "PDF document";
  }

  if (item.mimeType?.startsWith("image/")) {
    return "PNG image";
  }

  if (item.mimeType === "text/csv") {
    return "CSV file";
  }

  return item.mimeType?.includes("wordprocessingml") ? "Word document" : "File";
}

function formatDriveDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric"
  }).format(new Date(value));
}
