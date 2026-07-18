import { ChevronRight } from "lucide-react";
import type { GlobalSearchResult } from "@proofpilot/types";
import {
  formatSearchBytes,
  formatSearchDate,
  formatSearchStatus,
  searchTypeConfig
} from "@/components/app/search/search-utils";
import { Badge } from "@/components/ui/badge";

interface SearchResultRowProps {
  onOpen: () => void;
  query: string;
  result: GlobalSearchResult;
}

export function SearchResultRow({ onOpen, query, result }: SearchResultRowProps) {
  const config = searchTypeConfig[result.type];
  const Icon = config.icon;

  return (
    <button
      className="group grid min-h-24 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 text-left hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-4 md:min-h-20 md:py-2.5"
      onClick={onOpen}
      type="button"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary md:h-10 md:w-10">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase text-primary">{config.label}</span>
          {result.status ? (
            <Badge variant={getSearchStatusVariant(result.status)}>
              {formatSearchStatus(result.status)}
            </Badge>
          ) : null}
        </span>
        <span className="mt-1 block break-words text-sm font-semibold text-foreground">
          <HighlightedText query={query} text={result.title} />
        </span>
        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground md:line-clamp-1">
          <HighlightedText query={query} text={result.excerpt} />
        </span>
        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground md:mt-1.5">
          <span>{formatSearchDate(result.date)}</span>
          {result.file ? <span>{formatSearchBytes(result.file.byteSize)}</span> : null}
          {result.caseTitle && result.type !== "CASE" ? <span>{result.caseTitle}</span> : null}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary"
      />
    </button>
  );
}

function HighlightedText({ query, text }: { query: string; text: string }) {
  if (!query) return text;

  const parts: Array<{ highlighted: boolean; value: string }> = [];
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  let cursor = 0;
  let matchIndex = normalizedText.indexOf(normalizedQuery);

  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      parts.push({ highlighted: false, value: text.slice(cursor, matchIndex) });
    }
    parts.push({
      highlighted: true,
      value: text.slice(matchIndex, matchIndex + query.length)
    });
    cursor = matchIndex + query.length;
    matchIndex = normalizedText.indexOf(normalizedQuery, cursor);
  }

  if (!parts.length) return text;
  if (cursor < text.length) parts.push({ highlighted: false, value: text.slice(cursor) });

  return parts.map((part, index) =>
    part.highlighted ? (
      <mark className="bg-transparent text-primary" key={`${part.value}-${index}`}>
        {part.value}
      </mark>
    ) : (
      <span key={`${part.value}-${index}`}>{part.value}</span>
    )
  );
}

function getSearchStatusVariant(status: string) {
  if (/FAILED|MISSING|NEEDS|OPEN/.test(status)) return "warning" as const;
  if (/READY|PROCESSED|FOUND|COMPLETE|RESOLVED|DOWNLOADED/.test(status)) {
    return "success" as const;
  }
  return "secondary" as const;
}
