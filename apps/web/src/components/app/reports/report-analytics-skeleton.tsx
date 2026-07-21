import { Card, CardContent, CardHeader } from "@/components/ui/card";

const metricPlaceholders = Array.from({ length: 6 }, (_, index) => index);
const rowPlaceholders = Array.from({ length: 4 }, (_, index) => index);

export function ReportAnalyticsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading report data" className="grid gap-5" role="status">
      <span className="sr-only">Loading report data</span>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {metricPlaceholders.map((placeholder) => (
          <Card key={placeholder}>
            <CardContent className="grid min-h-32 content-between gap-3 p-4">
              <span className="h-5 w-5 rounded-sm bg-secondary" />
              <span className="grid gap-2">
                <span className="h-7 w-12 rounded-sm bg-secondary" />
                <span className="h-3 w-20 max-w-full rounded-sm bg-secondary/80" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <SkeletonPanel />
        <SkeletonPanel />
      </div>
    </div>
  );
}

function SkeletonPanel() {
  return (
    <Card>
      <CardHeader>
        <span className="h-4 w-36 rounded-sm bg-secondary" />
      </CardHeader>
      <CardContent className="grid min-h-56 content-start gap-4">
        {rowPlaceholders.map((placeholder) => (
          <span className="grid gap-2" key={placeholder}>
            <span className="h-3 w-28 rounded-sm bg-secondary/80" />
            <span className="h-2 w-full rounded-sm bg-secondary" />
          </span>
        ))}
      </CardContent>
    </Card>
  );
}
