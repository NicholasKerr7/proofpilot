"use client";

import {
  BarChart3,
  CalendarDays,
  Clock3,
  FolderOpen,
  Home,
  Inbox,
  ListChecks,
  Menu,
  RadioTower,
  Sparkles,
  UploadCloud,
  Waypoints,
  type LucideIcon
} from "lucide-react";
import { ProofPilotWordmark } from "@/components/app/app-shell-header";
import type { AppView } from "@/components/app/app-shell-types";
import type { CaseDestinationId } from "@/components/app/cases/case-utils";
import { ApiStatus } from "@/components/system/api-status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PrimaryNavigationView =
  | "home"
  | "cases"
  | "assistant"
  | "upload"
  | "inbox"
  | "more";

interface NavigationItem {
  icon: LucideIcon;
  label: string;
  view: PrimaryNavigationView;
}

interface DesktopNavigationItem {
  destinationId?: CaseDestinationId;
  icon: LucideIcon;
  label: string;
  view?: AppView;
}

const navItems: NavigationItem[] = [
  { label: "Home", view: "home", icon: Home },
  { label: "Cases", view: "cases", icon: FolderOpen },
  { label: "Assistant", view: "assistant", icon: Sparkles },
  { label: "Upload", view: "upload", icon: UploadCloud },
  { label: "Inbox", view: "inbox", icon: Inbox },
  { label: "More", view: "more", icon: Menu }
];

const phoneNavItems = navItems.filter((item) => item.view !== "assistant");

const desktopNavItems: DesktopNavigationItem[] = [
  { label: "Home", view: "home", icon: Home },
  { label: "Cases", view: "cases", icon: FolderOpen },
  { label: "Upload / Evidence", view: "upload", icon: UploadCloud },
  { label: "Inbox", view: "inbox", icon: Inbox },
  { label: "Proof Map", destinationId: "proof-map", icon: Waypoints },
  { label: "Timeline", destinationId: "case-timeline", icon: Clock3 },
  { label: "Submission", destinationId: "submission-tracker", icon: RadioTower },
  { label: "Tasks", view: "tasks", icon: ListChecks },
  { label: "Reports", view: "reports", icon: BarChart3 },
  { label: "More", view: "more", icon: Menu }
];

const calendarDesktopNavigationItem: DesktopNavigationItem = {
  label: "Calendar",
  view: "calendar",
  icon: CalendarDays
};

interface DesktopSidebarProps {
  activeCaseDestinationId: CaseDestinationId;
  activeView: AppView;
  hasCase: boolean;
  onNavigate: (view: AppView) => void;
  onNavigateCaseDestination: (destinationId: CaseDestinationId) => void;
  unreadInboxCount: number;
}

/** Renders desktop primary navigation and case-specific destinations. */
export function DesktopSidebar({
  activeCaseDestinationId,
  activeView,
  hasCase,
  onNavigate,
  onNavigateCaseDestination,
  unreadInboxCount
}: DesktopSidebarProps) {
  const visibleItems =
    activeView === "calendar"
      ? [
          ...desktopNavItems.slice(0, 6),
          calendarDesktopNavigationItem,
          ...desktopNavItems.slice(6)
        ]
      : desktopNavItems;

  return (
    <aside className="proof-sidebar fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-background/95 backdrop-blur lg:flex lg:flex-col">
      <div className="flex h-20 shrink-0 items-center border-b border-border px-5">
        <ProofPilotWordmark />
      </div>

      <nav className="grid gap-1 overflow-y-auto px-4 py-5 scroll-container" aria-label="Primary">
        {visibleItems.map((item) => {
          const isActive = isDesktopNavigationActive(
            activeView,
            activeCaseDestinationId,
            item
          );
          const isDisabled = Boolean(item.destinationId && !hasCase);

          return (
            <Button
              key={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn("min-h-12 justify-start", isActive ? "proof-nav-active" : null)}
              disabled={isDisabled}
              onClick={() => {
                if (item.destinationId) {
                  onNavigateCaseDestination(item.destinationId);
                } else if (item.view) {
                  onNavigate(item.view);
                }
              }}
              type="button"
              variant={isActive ? "secondary" : "ghost"}
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
              {item.view === "inbox" && unreadInboxCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
                >
                  {Math.min(unreadInboxCount, 99)}
                </span>
              ) : null}
            </Button>
          );
        })}
      </nav>

      <div className="proof-sidebar-promo mx-4 mt-auto grid gap-4 rounded-md border border-primary/25 bg-card p-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">Build a stronger appeal</p>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Keep evidence organized and every required item visible.
          </p>
        </div>
        <Button onClick={() => onNavigate("billing")} type="button">
          Manage plan
        </Button>
      </div>

      <div className="px-5 py-4">
        <ApiStatus />
      </div>
    </aside>
  );
}

interface ResponsiveBottomNavigationProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  unreadInboxCount: number;
}

/** Renders the phone and tablet bottom-navigation variants. */
export function ResponsiveBottomNavigation({
  activeView,
  onNavigate,
  unreadInboxCount
}: ResponsiveBottomNavigationProps) {
  return (
    <>
      <BottomNavigation
        activeView={activeView}
        className="grid grid-cols-5 sm:hidden"
        includeAssistantInMore
        items={phoneNavItems}
        onNavigate={onNavigate}
        unreadInboxCount={unreadInboxCount}
      />
      <BottomNavigation
        activeView={activeView}
        className="hidden grid-cols-6 sm:grid"
        includeAssistantInMore={false}
        items={navItems}
        onNavigate={onNavigate}
        unreadInboxCount={unreadInboxCount}
      />
    </>
  );
}

interface BottomNavigationProps extends ResponsiveBottomNavigationProps {
  className: string;
  includeAssistantInMore: boolean;
  items: NavigationItem[];
}

/** Renders one breakpoint-specific bottom-navigation item set. */
function BottomNavigation({
  activeView,
  className,
  includeAssistantInMore,
  items,
  onNavigate,
  unreadInboxCount
}: BottomNavigationProps) {
  return (
    <nav
      className={cn(
        "proof-bottom-navigation fixed inset-x-0 bottom-0 z-50 mx-auto max-w-3xl border-t border-border bg-background/95 px-1 pb-4 pt-2 backdrop-blur md:border-x md:px-3 lg:hidden",
        className
      )}
      aria-label="Primary mobile"
    >
      {items.map((item) => {
        const isActive = isNavigationActive(activeView, item.view, includeAssistantInMore);

        return (
          <button
            key={item.view}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xs",
              isActive ? "proof-bottom-nav-active text-primary" : null
            )}
            onClick={() => onNavigate(item.view)}
            type="button"
          >
            <span className="relative">
              <item.icon className="h-5 w-5" aria-hidden="true" />
              {item.view === "inbox" && unreadInboxCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground"
                >
                  {Math.min(unreadInboxCount, 99)}
                </span>
              ) : null}
            </span>
            <span className="max-w-full truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** Resolves active state for primary mobile navigation groups. */
function isNavigationActive(
  activeView: AppView,
  navigationView: PrimaryNavigationView,
  includeAssistantInMore: boolean
) {
  if (navigationView === "cases") {
    return (
      activeView === "cases" ||
      activeView === "create" ||
      activeView === "case" ||
      activeView === "collaboration" ||
      activeView === "share-packet"
    );
  }

  if (navigationView === "inbox") {
    return activeView === "inbox";
  }

  if (navigationView === "more") {
    return (
      activeView === "more" ||
      (includeAssistantInMore && activeView === "assistant") ||
      activeView === "notifications" ||
      activeView === "account" ||
      activeView === "reports" ||
      activeView === "tasks" ||
      activeView === "calendar" ||
      activeView === "settings" ||
      activeView === "connections" ||
      activeView === "billing" ||
      activeView === "security" ||
      activeView === "help" ||
      activeView === "search"
    );
  }

  return activeView === navigationView;
}

/** Resolves active state for desktop views and case subviews. */
function isDesktopNavigationActive(
  activeView: AppView,
  activeCaseDestinationId: CaseDestinationId,
  item: DesktopNavigationItem
) {
  if (item.destinationId) {
    return activeView === "case" && activeCaseDestinationId === item.destinationId;
  }

  if (item.view === "cases") {
    return (
      activeView === "cases" ||
      activeView === "create" ||
      activeView === "collaboration" ||
      activeView === "share-packet" ||
      (activeView === "case" &&
        activeCaseDestinationId !== "proof-map" &&
        activeCaseDestinationId !== "case-timeline" &&
        activeCaseDestinationId !== "submission-tracker" &&
        activeCaseDestinationId !== "evidence-checklist")
    );
  }

  if (item.view === "inbox") {
    return activeView === "inbox";
  }

  if (item.view === "more") {
    return (
      activeView === "more" ||
      activeView === "assistant" ||
      activeView === "account" ||
      activeView === "settings" ||
      activeView === "connections" ||
      activeView === "billing" ||
      activeView === "security" ||
      activeView === "help" ||
      activeView === "search"
    );
  }

  return activeView === item.view;
}
