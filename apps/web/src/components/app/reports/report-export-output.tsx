import { CheckCircle2, Download, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ReportExportOutput() {
  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase text-primary">3. Export format</CardTitle>
          <CardDescription>Structured case data ready for review or analysis.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-primary/50 bg-primary/10 p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">CSV spreadsheet</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Best for sorting, filtering, and data analysis.
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-teal-300" aria-hidden="true" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm uppercase text-primary">4. Delivery</CardTitle>
          <CardDescription>The generated report downloads directly to this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-primary/50 bg-primary/10 p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
              <Download className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Download now</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Save the generated report to this device.
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-teal-300" aria-hidden="true" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
