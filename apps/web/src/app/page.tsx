import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  FileArchive,
  FileText,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  UploadCloud
} from "lucide-react";
import { ApiStatus } from "@/components/system/api-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { caseCards, checklist, metrics, navItems, timeline } from "@/lib/demo-data";

export default function Home() {
  return (
    <main className="min-h-screen pb-24 lg:pb-0">
      <DesktopSidebar />
      <MobileTopBar />

      <section className="mx-auto flex w-full max-w-[1560px] flex-col gap-5 px-4 py-4 sm:px-6 lg:pl-72 lg:pr-8 lg:pt-8">
        <WorkspaceHeader />
        <MetricGrid />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <div className="grid gap-5">
            <CaseCommandCenter />
            <EvidenceAndTimeline />
          </div>
          <aside className="grid gap-5">
            <ChecklistPanel />
            <StatementBuilder />
            <PacketReadiness />
          </aside>
        </div>
      </section>

      <MobileBottomNav />
    </main>
  );
}

function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-background/82 px-4 py-5 backdrop-blur lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/35 bg-primary/15 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">ProofPilot</p>
          <p className="text-xs text-muted-foreground">Case Packet Automation</p>
        </div>
      </div>

      <nav className="mt-8 grid gap-1">
        {navItems.map((item, index) => (
          <Button
            key={item.label}
            variant={index === 0 ? "secondary" : "ghost"}
            className="justify-start"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Button>
        ))}
      </nav>

      <div className="mt-auto rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold">Private by default</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Cases, evidence, packets, and audit logs are isolated per account.
        </p>
      </div>
    </aside>
  );
}

function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/82 px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/35 bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">ProofPilot</p>
            <p className="text-xs text-muted-foreground">Appeal Builder</p>
          </div>
        </div>
        <ApiStatus />
      </div>
    </header>
  );
}

function WorkspaceHeader() {
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-card/70 p-4 backdrop-blur sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge>Account Ban / Appeal Builder</Badge>
          <div className="hidden lg:block">
            <ApiStatus />
          </div>
        </div>
        <h1 className="max-w-3xl text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
          Build a clean appeal packet from messy screenshots, emails, PDFs, and notes.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Sprint 0 foundation is active: responsive shell, API health, Prisma schema,
          local services, auth routes, and protected case routes.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button>
          <Plus className="h-4 w-4" />
          New case
        </Button>
        <Button variant="outline">
          <UploadCloud className="h-4 w-4" />
          Upload
        </Button>
      </div>
    </div>
  );
}

function MetricGrid() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <CardContent className="flex items-start justify-between gap-4 p-4">
            <div>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold">{metric.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
              <metric.icon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function CaseCommandCenter() {
  return (
    <Card>
      <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Case command center</CardTitle>
          <CardDescription>Private cases owned by the signed-in user.</CardDescription>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search cases" className="pl-9 sm:w-64" placeholder="Search cases" />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {caseCards.map((caseCard) => (
          <article
            key={caseCard.title}
            className="grid gap-4 rounded-lg border border-border bg-secondary/45 p-4 md:grid-cols-[1fr_180px] md:items-center"
          >
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{caseCard.platform}</Badge>
                <Badge variant={caseCard.status === "Needs review" ? "warning" : "default"}>
                  {caseCard.status}
                </Badge>
              </div>
              <h2 className="text-base font-semibold">{caseCard.title}</h2>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <span>{caseCard.evidence} evidence files</span>
                <span>{caseCard.gaps} gaps</span>
                <span>Due {caseCard.due}</span>
              </div>
            </div>
            <div className="grid gap-3">
              <Progress value={caseCard.progress} label="Packet readiness" />
              <Button variant="outline" size="sm">
                Open case
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}

function EvidenceAndTimeline() {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Evidence intake</CardTitle>
          <CardDescription>Tap-first upload flow, with desktop drag and drop later.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-primary/45 bg-primary/10 p-5 text-center">
            <div>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary/20 text-primary">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="font-semibold">Upload screenshots, PDFs, images, or notes</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Files stay private and will trigger document processing jobs in Sprint 2.
              </p>
              <Button className="mt-4">
                <UploadCloud className="h-4 w-4" />
                Choose files
              </Button>
            </div>
          </div>
          <div className="grid gap-2 text-sm">
            {["closure-notice.png", "support-thread.pdf", "email-export.txt"].map((file) => (
              <div
                key={file}
                className="flex items-center justify-between rounded-md border border-border bg-secondary/45 px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{file}</span>
                </span>
                <Badge variant="success">Processed</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated timeline</CardTitle>
          <CardDescription>Chronology from document dates and user-entered events.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {timeline.map((item) => (
            <div key={item.title} className="grid grid-cols-[76px_1fr] gap-3">
              <div className="text-xs font-medium text-muted-foreground">{item.date}</div>
              <div className="border-l border-border pl-4">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.source} · {item.confidence} confidence
                </p>
              </div>
            </div>
          ))}
          <Button variant="outline">
            <CalendarClock className="h-4 w-4" />
            Add event
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ChecklistPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Missing evidence detector</CardTitle>
        <CardDescription>Plain-language checklist for the appeal template.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {checklist.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/45 px-3 py-3"
          >
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <item.icon className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{item.label}</span>
            </span>
            <Badge
              variant={
                item.tone === "success"
                  ? "success"
                  : item.tone === "warning"
                    ? "warning"
                    : "secondary"
              }
            >
              {item.status}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StatementBuilder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Statement builder</CardTitle>
        <CardDescription>Guided draft structure for the appeal narrative.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="outcome">Requested outcome</Label>
          <Input id="outcome" placeholder="Restore account access and release held funds" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="statement">Draft statement</Label>
          <Textarea
            id="statement"
            placeholder="Explain what happened, what evidence supports it, and what action you want the platform to take."
          />
        </div>
        <Button variant="secondary">
          <FileText className="h-4 w-4" />
          Save draft
        </Button>
      </CardContent>
    </Card>
  );
}

function PacketReadiness() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Packet readiness</CardTitle>
        <CardDescription>Export pipeline sections for the final PDF packet.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Progress value={64} label="Overall readiness" />
        <Separator />
        <div className="grid gap-2 text-sm">
          {["Case summary", "Timeline", "Evidence index", "User statement"].map((section) => (
            <div key={section} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {section}
              </span>
              <Badge variant="secondary">Draft</Badge>
            </div>
          ))}
        </div>
        <Button>
          <FileArchive className="h-4 w-4" />
          Generate packet
        </Button>
      </CardContent>
    </Card>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-border bg-background/92 px-2 pb-3 pt-2 backdrop-blur lg:hidden">
      {navItems.map((item, index) => (
        <button
          key={item.label}
          type="button"
          className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-secondary data-[active=true]:text-foreground"
          data-active={index === 0}
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
