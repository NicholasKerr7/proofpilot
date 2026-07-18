import type {
  GlobalSearchResult,
  GlobalSearchResultType
} from "@proofpilot/types";
import { SearchResultRow } from "@/components/app/search/search-result-row";
import { searchTypeConfig } from "@/components/app/search/search-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SearchResultGroupProps {
  onOpenResult: (result: GlobalSearchResult) => void;
  query: string;
  results: GlobalSearchResult[];
  total: number;
  type: GlobalSearchResultType;
}

export function SearchResultGroup({
  onOpenResult,
  query,
  results,
  total,
  type
}: SearchResultGroupProps) {
  const config = searchTypeConfig[type];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center md:px-5 md:py-3">
        <CardTitle className="flex items-center gap-2 md:text-sm md:uppercase md:text-primary">
          <Icon aria-hidden="true" className="h-5 w-5 text-primary" />
          {config.pluralLabel}
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {total} {total === 1 ? "result" : "results"}
        </span>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {results.map((result) => (
          <SearchResultRow
            key={`${result.type}-${result.id}`}
            onOpen={() => onOpenResult(result)}
            query={query}
            result={result}
          />
        ))}
      </CardContent>
    </Card>
  );
}
