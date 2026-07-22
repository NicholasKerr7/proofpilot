"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  Clock3,
  FolderOpen,
  Home,
  Inbox,
  ListChecks,
  LogOut,
  Menu,
  Search,
  Sparkles,
  UploadCloud,
  UserRound,
  type LucideIcon
} from "lucide-react";
import { getUserInitials } from "@/components/app/account/account-utils";
import type { CaseDestinationId } from "@/components/app/cases/case-utils";
import { ApiStatus } from "@/components/system/api-status";
import { Button } from "@/components/ui/button";
import type { AuthUser } from "@/lib/client/types";
import { cn } from "@/lib/utils";

export type AppView =
  | "home"
  | "cases"
  | "create"
  | "case"
  | "collaboration"
  | "share-packet"
  | "assistant"
  | "upload"
  | "notifications"
  | "account"
  | "reports"
  | "tasks"
  | "calendar"
  | "settings"
  | "connections"
  | "billing"
  | "security"
  | "help"
  | "search"
  | "more";

type PrimaryNavigationView =
  | "home"
  | "cases"
  | "assistant"
  | "upload"
  | "notifications"
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
  { label: "Inbox", view: "notifications", icon: Inbox },
  { label: "More", view: "more", icon: Menu }
];

const phoneNavItems = navItems.filter((item) => item.view !== "assistant");

const desktopNavItems: DesktopNavigationItem[] = [
  { label: "Home", view: "home", icon: Home },
  { label: "Cases", view: "cases", icon: FolderOpen },
  { label: "Upload / Evidence", view: "upload", icon: UploadCloud },
  { label: "Inbox", view: "notifications", icon: Inbox },
  { label: "Timeline", destinationId: "case-timeline", icon: Clock3 },
  { label: "Tasks", view: "tasks", icon: ListChecks },
  { label: "Reports", view: "reports", icon: BarChart3 },
  { label: "More", view: "more", icon: Menu }
];

const calendarDesktopNavigationItem: DesktopNavigationItem = {
  label: "Calendar",
  view: "calendar",
  icon: CalendarDays
};

interface AppShellProps {
  activeCaseDestinationId: CaseDestinationId;
  activeView: AppView;
  children: React.ReactNode;
  hasCase: boolean;
  onLogout: () => Promise<void>;
  onNavigate: (view: AppView) => void;
  onNavigateCaseDestination: (destinationId: CaseDestinationId) => void;
  unreadNotificationCount: number;
  user: AuthUser;
}

export function AppShell({
  activeCaseDestinationId,
  activeView,
  children,
  hasCase,
  onLogout,
  onNavigate,
  onNavigateCaseDestination,
  unreadNotificationCount,
  user
}: AppShellProps) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const desktopAccountTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileAccountTriggerRef = useRef<HTMLButtonElement>(null);
  const visibleDesktopNavItems =
    activeView === "calendar"
      ? [
          ...desktopNavItems.slice(0, 6),
          calendarDesktopNavigationItem,
          ...desktopNavItems.slice(6)
        ]
      : desktopNavItems;

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsAccountMenuOpen(false);
        onNavigate("search");
      }

      if (event.key === "Escape" && isAccountMenuOpen) {
        setIsAccountMenuOpen(false);
        window.requestAnimationFrame(() => {
          const visibleTrigger = [
            desktopAccountTriggerRef.current,
            mobileAccountTriggerRef.current
          ].find((trigger) => trigger && trigger.getClientRects().length > 0);

          visibleTrigger?.focus();
        });
      }
    }

    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, [isAccountMenuOpen, onNavigate]);

  function handleNavigate(view: AppView) {
    setIsAccountMenuOpen(false);
    onNavigate(view);
  }

  function handleCaseDestinationNavigate(destinationId: CaseDestinationId) {
    setIsAccountMenuOpen(false);
    onNavigateCaseDestination(destinationId);
  }

  async function handleLogout() {
    setIsAccountMenuOpen(false);
    await onLogout();
  }

  return (
    <div className="min-h-screen pb-28 lg:pb-0">
      <a
        href="#proofpilot-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        Skip to workspace
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-background/95 backdrop-blur lg:flex lg:flex-col">
        <div className="flex h-20 shrink-0 items-center border-b border-border px-5">
          <ProofPilotWordmark />
        </div>

        <nav className="grid gap-1 overflow-y-auto px-4 py-5 scroll-container" aria-label="Primary">
          {visibleDesktopNavItems.map((item) => {
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
                    handleCaseDestinationNavigate(item.destinationId);
                  } else if (item.view) {
                    handleNavigate(item.view);
                  }
                }}
                type="button"
                variant={isActive ? "secondary" : "ghost"}
              >
                <item.icon className="h-5 w-5" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                {item.view === "notifications" && unreadNotificationCount > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {Math.min(unreadNotificationCount, 99)}
                  </span>
                ) : null}
              </Button>
            );
          })}
        </nav>

        <div className="proof-sidebar-promo mx-4 mt-auto grid gap-4 rounded-md border border-primary/30 bg-card p-4">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">Build a stronger appeal</p>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Keep evidence organized and every required item visible.
            </p>
          </div>
          <Button onClick={() => handleNavigate("billing")} type="button">
            Manage plan
          </Button>
        </div>

        <div className="px-5 py-4">
          <ApiStatus />
        </div>
      </aside>

      <header className="fixed left-64 right-0 top-0 z-30 hidden h-20 items-center justify-between gap-6 border-b border-border bg-background/92 px-6 backdrop-blur lg:flex xl:px-8">
        <button
          aria-label="Open global search"
          className="flex h-12 w-full max-w-xl items-center gap-3 rounded-md border border-border bg-input px-4 text-left text-sm text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => handleNavigate("search")}
          type="button"
        >
          <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Search cases, evidence, or tasks...</span>
          <kbd className="rounded-sm border border-border bg-secondary/60 px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
            Cmd K
          </kbd>
        </button>

        <div className="relative flex shrink-0 items-center gap-3">
          <Button
            aria-label={
              unreadNotificationCount
                ? `Open inbox, ${unreadNotificationCount} unread`
                : "Open inbox"
            }
            className="relative"
            onClick={() => handleNavigate("notifications")}
            size="icon"
            title="Inbox"
            type="button"
            variant="ghost"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {unreadNotificationCount > 0 ? (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                {Math.min(unreadNotificationCount, 99)}
              </span>
            ) : null}
          </Button>

          <div className="hidden text-right xl:block">
            <p className="max-w-44 truncate text-sm font-semibold">{user.name ?? "ProofPilot user"}</p>
            <p className="text-xs text-primary">Private workspace</p>
          </div>

          <button
            aria-expanded={isAccountMenuOpen}
            aria-controls="desktop-account-popover"
            aria-label="Open account menu"
            className="flex min-h-11 items-center gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setIsAccountMenuOpen((current) => !current)}
            ref={desktopAccountTriggerRef}
            type="button"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/55 bg-primary/10 text-sm font-semibold text-primary">
              {getUserInitials(user)}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isAccountMenuOpen ? "rotate-180" : null
              )}
              aria-hidden="true"
            />
          </button>

          {isAccountMenuOpen ? (
            <AccountPopover
              id="desktop-account-popover"
              onLogout={handleLogout}
              onNavigate={handleNavigate}
              user={user}
            />
          ) : null}
        </div>
      </header>

      <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-8 md:py-4 lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <ProofPilotWordmark />

          <div className="relative flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="max-w-40 truncate text-sm font-semibold">{user.name ?? "ProofPilot user"}</p>
              <p className="text-xs text-primary">Private workspace</p>
            </div>
            <button
              aria-expanded={isAccountMenuOpen}
              aria-controls="account-popover"
              aria-label="Open account menu"
              className="flex min-h-11 items-center gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setIsAccountMenuOpen((current) => !current)}
              ref={mobileAccountTriggerRef}
              type="button"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/55 bg-primary/10 text-sm font-semibold text-primary">
                {getUserInitials(user)}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  isAccountMenuOpen ? "rotate-180" : null
                )}
                aria-hidden="true"
              />
            </button>

            {isAccountMenuOpen ? (
              <AccountPopover
                id="account-popover"
                onLogout={handleLogout}
                onNavigate={handleNavigate}
                user={user}
              />
            ) : null}
          </div>
        </div>
      </header>

      <main
        id="proofpilot-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-4 focus:outline-none sm:px-6 md:gap-6 md:px-8 md:py-6 lg:ml-64 lg:w-auto lg:max-w-none lg:px-6 lg:pb-8 lg:pt-24 xl:px-8"
      >
        {children}
      </main>

      <BottomNavigation
        activeView={activeView}
        className="grid grid-cols-5 sm:hidden"
        includeAssistantInMore
        items={phoneNavItems}
        onNavigate={handleNavigate}
      />
      <BottomNavigation
        activeView={activeView}
        className="hidden grid-cols-6 sm:grid"
        includeAssistantInMore={false}
        items={navItems}
        onNavigate={handleNavigate}
      />
    </div>
  );
}

function AccountPopover({
  id,
  onLogout,
  onNavigate,
  user
}: {
  id: string;
  onLogout: () => Promise<void>;
  onNavigate: (view: AppView) => void;
  user: AuthUser;
}) {
  return (
    <div
      aria-label="Account details"
      className="absolute right-0 top-14 z-50 grid w-72 gap-3 rounded-md border border-border bg-background p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
      id={id}
      role="region"
    >
      <div className="min-w-0">
        <p className="font-semibold text-foreground">{user.name ?? "ProofPilot user"}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <ApiStatus />
      <Button onClick={() => onNavigate("account")} type="button" variant="outline">
        <UserRound className="h-4 w-4" aria-hidden="true" />
        Manage account
      </Button>
      <Button
        onClick={() => {
          void onLogout();
        }}
        type="button"
        variant="outline"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Sign out
      </Button>
    </div>
  );
}

function ProofPilotWordmark() {
  return (
    <div className="flex min-w-0 items-center gap-2" aria-label="ProofPilot">
      <Image
        alt=""
        className="h-10 w-10 shrink-0 object-contain"
        height={40}
        priority
        src="/brand/proofpilot-brand-icon-transparent.webp"
        width={40}
      />
      <span className="truncate text-lg font-semibold text-foreground sm:text-xl">
        Proof<span className="text-primary">Pilot</span>
      </span>
    </div>
  );
}

interface BottomNavigationProps {
  activeView: AppView;
  className: string;
  includeAssistantInMore: boolean;
  items: NavigationItem[];
  onNavigate: (view: AppView) => void;
}

function BottomNavigation({
  activeView,
  className,
  includeAssistantInMore,
  items,
  onNavigate
}: BottomNavigationProps) {
  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-3xl border-t border-border bg-background/95 px-1 pb-4 pt-2 backdrop-blur md:border-x md:px-3 lg:hidden",
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
              isActive ? "proof-nav-active text-primary" : null
            )}
            onClick={() => onNavigate(item.view)}
            type="button"
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            <span className="max-w-full truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

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

  if (navigationView === "more") {
    return (
      activeView === "more" ||
      (includeAssistantInMore && activeView === "assistant") ||
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
        activeCaseDestinationId !== "case-timeline" &&
        activeCaseDestinationId !== "evidence-checklist")
    );
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
