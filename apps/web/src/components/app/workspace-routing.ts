import type { AccountSection } from "@/components/app/account/account-panel";
import type { AppView } from "@/components/app/app-shell";
import type { CaseDestinationId } from "@/components/app/cases/case-utils";

export interface WorkspaceRoute {
  accountSection: AccountSection;
  caseId: string | null;
  destinationId: CaseDestinationId;
  view: AppView;
}

const destinationSegments = {
  "case-overview": "overview",
  "evidence-intake": "evidence",
  "case-timeline": "timeline",
  "evidence-checklist": "checklist",
  "statement-builder": "statement",
  "packet-export": "packet",
  "case-reminders": "reminders",
  "case-activity": "activity"
} satisfies Record<CaseDestinationId, string>;

const segmentDestinations = Object.fromEntries(
  Object.entries(destinationSegments).map(([destinationId, segment]) => [
    segment,
    destinationId
  ])
) as Record<string, CaseDestinationId>;

const viewPaths = {
  home: "/app",
  cases: "/app/cases",
  create: "/app/cases/new",
  assistant: "/app/assistant",
  upload: "/app/evidence",
  inbox: "/app/inbox",
  notifications: "/app/notifications",
  reports: "/app/reports",
  tasks: "/app/tasks",
  calendar: "/app/calendar",
  settings: "/app/settings",
  connections: "/app/connections",
  billing: "/app/billing",
  security: "/app/security",
  help: "/app/help",
  search: "/app/search",
  more: "/app/more"
} satisfies Partial<Record<AppView, string>>;

export function resolveWorkspaceRoute(pathname: string): WorkspaceRoute {
  const segments = pathname.split("/").filter(Boolean);
  const fallback: WorkspaceRoute = {
    accountSection: "profile",
    caseId: null,
    destinationId: "case-overview",
    view: "home"
  };

  if (segments[0] !== "app") {
    return fallback;
  }

  if (segments[1] === "cases") {
    if (!segments[2]) {
      return { ...fallback, view: "cases" };
    }

    if (segments[2] === "new") {
      return { ...fallback, view: "create" };
    }

    const caseId = decodeURIComponent(segments[2]);
    const caseSurface = segments[3];

    if (caseSurface === "collaboration") {
      return { ...fallback, caseId, view: "collaboration" };
    }

    if (caseSurface === "share") {
      return { ...fallback, caseId, destinationId: "packet-export", view: "share-packet" };
    }

    return {
      ...fallback,
      caseId,
      destinationId: segmentDestinations[caseSurface ?? "overview"] ?? "case-overview",
      view: "case"
    };
  }

  if (segments[1] === "account") {
    return {
      ...fallback,
      accountSection: segments[2] === "security" ? "security" : "profile",
      view: "account"
    };
  }

  const matchedView = Object.entries(viewPaths).find(([, path]) => path === pathname)?.[0];

  return matchedView
    ? { ...fallback, view: matchedView as AppView }
    : fallback;
}

export function getCaseWorkspacePath(
  caseId: string,
  destinationId: CaseDestinationId = "case-overview"
) {
  return `/app/cases/${encodeURIComponent(caseId)}/${destinationSegments[destinationId]}`;
}

export function getWorkspaceViewPath(
  view: AppView,
  options: {
    accountSection?: AccountSection;
    caseId?: string | null;
    destinationId?: CaseDestinationId;
  } = {}
) {
  if (view === "case") {
    return options.caseId
      ? getCaseWorkspacePath(options.caseId, options.destinationId)
      : viewPaths.cases;
  }

  if (view === "collaboration") {
    return options.caseId
      ? `/app/cases/${encodeURIComponent(options.caseId)}/collaboration`
      : viewPaths.cases;
  }

  if (view === "share-packet") {
    return options.caseId
      ? `/app/cases/${encodeURIComponent(options.caseId)}/share`
      : viewPaths.cases;
  }

  if (view === "account") {
    return `/app/account/${options.accountSection ?? "profile"}`;
  }

  return viewPaths[view] ?? viewPaths.home;
}

export function isWorkspacePath(pathname: string) {
  return pathname === "/app" || pathname.startsWith("/app/");
}
