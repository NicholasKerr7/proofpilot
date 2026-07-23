"use client";

import type { RefObject } from "react";
import Image from "next/image";
import {
  Bell,
  ChevronDown,
  LogOut,
  Search,
  UserRound
} from "lucide-react";
import { getUserInitials } from "@/components/app/account/account-utils";
import type { AppView } from "@/components/app/app-shell-types";
import { ApiStatus } from "@/components/system/api-status";
import { Button } from "@/components/ui/button";
import type { AuthUser } from "@/lib/client/types";
import { cn } from "@/lib/utils";

interface ShellHeaderProps {
  activeView: AppView;
  accountTriggerRef: RefObject<HTMLButtonElement | null>;
  isAccountMenuOpen: boolean;
  onLogout: () => Promise<void>;
  onNavigate: (view: AppView) => void;
  onToggleAccountMenu: () => void;
  unreadNotificationCount: number;
  user: AuthUser;
}

/** Renders the command bar and account controls used on desktop. */
export function DesktopShellHeader({
  activeView,
  accountTriggerRef,
  isAccountMenuOpen,
  onLogout,
  onNavigate,
  onToggleAccountMenu,
  unreadNotificationCount,
  user
}: ShellHeaderProps) {
  return (
    <header className="proof-shell-header fixed left-64 right-0 top-0 z-30 hidden h-20 items-center justify-between gap-6 border-b border-border bg-background/92 px-6 backdrop-blur lg:flex xl:px-8">
      <button
        aria-label="Open global search"
        className="proof-command-search flex h-12 w-full max-w-xl items-center gap-3 rounded-md border border-border bg-input px-4 text-left text-sm text-muted-foreground transition-colors hover:border-primary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onNavigate("search")}
        type="button"
      >
        <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">Search cases, evidence, or tasks...</span>
        <kbd className="rounded-sm border border-border bg-secondary/60 px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
          Cmd K
        </kbd>
      </button>

      <div className="relative flex shrink-0 items-center gap-3">
        <NotificationButton
          activeView={activeView}
          onNavigate={onNavigate}
          unreadNotificationCount={unreadNotificationCount}
        />

        <UserSummary className="hidden text-right xl:block" user={user} />

        <AccountMenuTrigger
          controls="desktop-account-popover"
          isOpen={isAccountMenuOpen}
          onToggle={onToggleAccountMenu}
          triggerRef={accountTriggerRef}
          user={user}
        />

        {isAccountMenuOpen ? (
          <AccountPopover
            id="desktop-account-popover"
            onLogout={onLogout}
            onNavigate={onNavigate}
            user={user}
          />
        ) : null}
      </div>
    </header>
  );
}

/** Renders the compact sticky header used below the desktop breakpoint. */
export function MobileShellHeader({
  activeView,
  accountTriggerRef,
  isAccountMenuOpen,
  onLogout,
  onNavigate,
  onToggleAccountMenu,
  unreadNotificationCount,
  user
}: ShellHeaderProps) {
  return (
    <header className="proof-shell-header sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-8 md:py-4 lg:hidden">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <ProofPilotWordmark />

        <div className="relative flex items-center gap-1.5">
          <UserSummary className="hidden text-right sm:block" user={user} />
          <Button
            aria-label="Open global search"
            onClick={() => onNavigate("search")}
            size="icon"
            title="Search"
            type="button"
            variant={activeView === "search" ? "secondary" : "ghost"}
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Button>
          <NotificationButton
            activeView={activeView}
            onNavigate={onNavigate}
            unreadNotificationCount={unreadNotificationCount}
          />
          <AccountMenuTrigger
            controls="account-popover"
            isOpen={isAccountMenuOpen}
            onToggle={onToggleAccountMenu}
            triggerRef={accountTriggerRef}
            user={user}
          />

          {isAccountMenuOpen ? (
            <AccountPopover
              id="account-popover"
              onLogout={onLogout}
              onNavigate={onNavigate}
              user={user}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}

/** Renders the shared ProofPilot brand mark used by shell navigation. */
export function ProofPilotWordmark() {
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

/** Renders the notification control with a bounded unread badge. */
function NotificationButton({
  activeView,
  onNavigate,
  unreadNotificationCount
}: Pick<ShellHeaderProps, "activeView" | "onNavigate" | "unreadNotificationCount">) {
  return (
    <Button
      aria-label={
        unreadNotificationCount
          ? `Open notifications, ${unreadNotificationCount} unread`
          : "Open notifications"
      }
      aria-current={activeView === "notifications" ? "page" : undefined}
      className="relative"
      onClick={() => onNavigate("notifications")}
      size="icon"
      title="Notifications"
      type="button"
      variant={activeView === "notifications" ? "secondary" : "ghost"}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unreadNotificationCount > 0 ? (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
          {Math.min(unreadNotificationCount, 99)}
        </span>
      ) : null}
    </Button>
  );
}

/** Renders the current user label at breakpoints with sufficient space. */
function UserSummary({ className, user }: { className: string; user: AuthUser }) {
  return (
    <div className={className}>
      <p className="max-w-44 truncate text-sm font-semibold">
        {user.name ?? "ProofPilot user"}
      </p>
      <p className="text-xs text-primary">
        {user.isPortfolioDemo ? "Portfolio demo" : "Private workspace"}
      </p>
    </div>
  );
}

/** Renders the shared account-menu trigger and focus target. */
function AccountMenuTrigger({
  controls,
  isOpen,
  onToggle,
  triggerRef,
  user
}: {
  controls: string;
  isOpen: boolean;
  onToggle: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  user: AuthUser;
}) {
  return (
    <button
      aria-expanded={isOpen}
      aria-controls={controls}
      aria-label="Open account menu"
      className="flex min-h-11 items-center gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onToggle}
      ref={triggerRef}
      type="button"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/55 bg-primary/10 text-sm font-semibold text-primary">
        {getUserInitials(user)}
      </span>
      <ChevronDown
        className={cn(
          "h-4 w-4 text-muted-foreground transition-transform",
          isOpen ? "rotate-180" : null
        )}
        aria-hidden="true"
      />
    </button>
  );
}

/** Renders account details and account/session actions. */
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
