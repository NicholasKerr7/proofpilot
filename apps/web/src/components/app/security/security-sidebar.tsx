import type { SecurityLoginActivity, SecurityOverview } from "@proofpilot/types";
import {
  CheckCircle2,
  CircleAlert,
  Globe2,
  Laptop,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet
} from "lucide-react";
import { formatSecurityActivityDate, formatSecurityDate } from "@/components/app/security/security-utils";
import { Badge } from "@/components/ui/badge";

export function SecuritySidebar({ overview }: { overview: SecurityOverview }) {
  return (
    <aside className="grid content-start gap-3">
      <LoginActivity activity={overview.loginActivity} />
      <SecuritySummary overview={overview} />
      <section className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-border bg-card p-4 md:p-5">
        <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Stay secure</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Review unfamiliar sign-ins and use a password that is unique to ProofPilot.
          </p>
        </div>
      </section>
    </aside>
  );
}

function LoginActivity({ activity }: { activity: SecurityLoginActivity[] }) {
  return (
    <section
      aria-labelledby="security-login-activity-heading"
      className="rounded-md border border-border bg-card p-4 md:p-5"
      id="security-login-activity"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase text-primary" id="security-login-activity-heading">
          Recent login activity
        </h2>
        <Badge variant="secondary">{activity.length} events</Badge>
      </div>

      {activity.length ? (
        <div className="mt-3 divide-y divide-border border-y border-border">
          {activity.map((entry) => (
            <LoginActivityRow entry={entry} key={entry.id} />
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">
          No recent login activity is available.
        </p>
      )}
    </section>
  );
}

function LoginActivityRow({ entry }: { entry: SecurityLoginActivity }) {
  const occurredAt = formatSecurityActivityDate(entry.occurredAt);

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3">
      <span className="relative flex h-11 w-11 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
        <DeviceIcon deviceLabel={entry.deviceLabel} />
        <span
          aria-hidden="true"
          className={`absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-card ${entry.isLatest ? "bg-teal-400" : "bg-muted-foreground"}`}
        />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words text-sm font-medium leading-5 text-foreground">
            {entry.deviceLabel}
          </p>
          {entry.isLatest ? <Badge variant="success">Latest</Badge> : null}
        </div>
        <p className="mt-0.5 break-words text-xs leading-5 text-muted-foreground">
          {entry.locationLabel}
        </p>
      </div>
      <div className="text-right text-xs leading-5 text-muted-foreground">
        <p>{occurredAt.date}</p>
        <p>{occurredAt.time}</p>
      </div>
    </div>
  );
}

function SecuritySummary({ overview }: { overview: SecurityOverview }) {
  return (
    <section aria-labelledby="security-summary-heading" className="rounded-md border border-border bg-card p-4 md:p-5">
      <h2 className="text-sm font-semibold uppercase text-primary" id="security-summary-heading">
        Security summary
      </h2>
      <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-border pb-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-md border border-teal-400/30 bg-teal-400/10 text-teal-300">
          <ShieldCheck className="h-7 w-7" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-teal-200">Core protection active</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Password authentication and owner-scoped access checks are active.
          </p>
        </div>
      </div>
      <div className="mt-2 divide-y divide-border">
        <SummaryItem
          description={`Changed ${formatSecurityDate(overview.passwordChangedAt)}`}
          label="Password protected"
          ready
        />
        <SummaryItem
          description={`${overview.loginActivity.length} recent successful sign-ins recorded`}
          label="Login activity"
          ready
        />
        <SummaryItem description="Enrollment not configured" label="Two-factor authentication" ready={false} />
        <SummaryItem description="WebAuthn enrollment not configured" label="Biometric lock" ready={false} />
      </div>
    </section>
  );
}

function SummaryItem({ description, label, ready }: { description: string; label: string; ready: boolean }) {
  const Icon = ready ? CheckCircle2 : CircleAlert;

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 py-3">
      <Icon className={`mt-0.5 h-5 w-5 ${ready ? "text-teal-300" : "text-amber-300"}`} aria-hidden="true" />
      <div>
        <p className="text-sm text-foreground">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function DeviceIcon({ deviceLabel }: { deviceLabel: string }) {
  if (/ipad|tablet/i.test(deviceLabel)) {
    return <Tablet className="h-5 w-5" aria-hidden="true" />;
  }
  if (/iphone|android|phone/i.test(deviceLabel)) {
    return <Smartphone className="h-5 w-5" aria-hidden="true" />;
  }
  if (/mac|windows|linux|laptop/i.test(deviceLabel)) {
    return <Laptop className="h-5 w-5" aria-hidden="true" />;
  }
  return <Globe2 className="h-5 w-5" aria-hidden="true" />;
}
