import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ReportDatePreset = 30 | 60 | 90 | "custom";

interface ReportExportDateRangeProps {
  from: string;
  onFromChange: (value: string) => void;
  onPresetChange: (preset: ReportDatePreset) => void;
  onToChange: (value: string) => void;
  preset: ReportDatePreset;
  to: string;
}

const reportDatePresets = [30, 60, 90] as const;

export function ReportExportDateRange({
  from,
  onFromChange,
  onPresetChange,
  onToChange,
  preset,
  to
}: ReportExportDateRangeProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm uppercase text-primary">1. Date range</CardTitle>
        <CardDescription>Select the activity window included in this report.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField
            id="report-from"
            label="Start date"
            max={to}
            onChange={(value) => {
              onFromChange(value);
              onPresetChange("custom");
            }}
            value={from}
          />
          <DateField
            id="report-to"
            label="End date"
            min={from}
            onChange={(value) => {
              onToChange(value);
              onPresetChange("custom");
            }}
            value={to}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Date range presets">
          {reportDatePresets.map((days) => (
            <Button
              aria-pressed={preset === days}
              className={cn(
                preset === days ? "border-primary bg-primary/10 text-primary" : null
              )}
              key={days}
              onClick={() => onPresetChange(days)}
              size="sm"
              type="button"
              variant="outline"
            >
              Last {days} days
            </Button>
          ))}
          <Button
            aria-pressed={preset === "custom"}
            className={cn(
              preset === "custom" ? "border-primary bg-primary/10 text-primary" : null
            )}
            onClick={() => onPresetChange("custom")}
            size="sm"
            type="button"
            variant="outline"
          >
            Custom
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface DateFieldProps {
  id: string;
  label: string;
  max?: string;
  min?: string;
  onChange: (value: string) => void;
  value: string;
}

function DateField({ id, label, max, min, onChange, value }: DateFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <CalendarDays
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
          aria-hidden="true"
        />
        <Input
          className="min-h-12 pl-10"
          id={id}
          max={max}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          required
          type="date"
          value={value}
        />
      </div>
    </div>
  );
}
