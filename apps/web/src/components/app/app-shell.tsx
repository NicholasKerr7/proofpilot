"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import {
  DesktopShellHeader,
  MobileShellHeader
} from "@/components/app/app-shell-header";
import {
  DesktopSidebar,
  ResponsiveBottomNavigation
} from "@/components/app/app-shell-navigation";
import type { AppView } from "@/components/app/app-shell-types";
import type { CaseDestinationId } from "@/components/app/cases/case-utils";
import type { AuthUser } from "@/lib/client/types";

export type { AppView } from "@/components/app/app-shell-types";

interface AppShellProps {
  activeCaseDestinationId: CaseDestinationId;
  activeView: AppView;
  children: React.ReactNode;
  hasCase: boolean;
  onLogout: () => Promise<void>;
  onNavigate: (view: AppView) => void;
  onNavigateCaseDestination: (destinationId: CaseDestinationId) => void;
  unreadInboxCount: number;
  unreadNotificationCount: number;
  user: AuthUser;
}

/** Frames authenticated content with responsive navigation and account controls. */
export function AppShell({
  activeCaseDestinationId,
  activeView,
  children,
  hasCase,
  onLogout,
  onNavigate,
  onNavigateCaseDestination,
  unreadInboxCount,
  unreadNotificationCount,
  user
}: AppShellProps) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const desktopAccountTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileAccountTriggerRef = useRef<HTMLButtonElement>(null);

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

  /** Closes transient account UI before changing views. */
  function handleNavigate(view: AppView) {
    setIsAccountMenuOpen(false);
    onNavigate(view);
  }

  /** Closes transient account UI before opening a case destination. */
  function handleCaseDestinationNavigate(destinationId: CaseDestinationId) {
    setIsAccountMenuOpen(false);
    onNavigateCaseDestination(destinationId);
  }

  /** Closes transient account UI before ending the session. */
  async function handleLogout() {
    setIsAccountMenuOpen(false);
    await onLogout();
  }

  const sharedHeaderProps = {
    activeView,
    isAccountMenuOpen,
    onLogout: handleLogout,
    onNavigate: handleNavigate,
    onToggleAccountMenu: () => setIsAccountMenuOpen((current) => !current),
    unreadNotificationCount,
    user
  };

  return (
    <div className="proof-app-shell min-h-screen pb-28 lg:pb-0">
      <a
        href="#proofpilot-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        Skip to workspace
      </a>

      <DesktopSidebar
        activeCaseDestinationId={activeCaseDestinationId}
        activeView={activeView}
        hasCase={hasCase}
        onNavigate={handleNavigate}
        onNavigateCaseDestination={handleCaseDestinationNavigate}
        unreadInboxCount={unreadInboxCount}
      />
      <DesktopShellHeader
        {...sharedHeaderProps}
        accountTriggerRef={desktopAccountTriggerRef}
      />
      <MobileShellHeader
        {...sharedHeaderProps}
        accountTriggerRef={mobileAccountTriggerRef}
      />

      <main
        id="proofpilot-content"
        tabIndex={-1}
        className="relative mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-4 focus:outline-none sm:px-6 md:gap-6 md:px-8 md:py-6 lg:ml-64 lg:w-auto lg:max-w-none lg:px-6 lg:pb-8 lg:pt-24 xl:px-8"
      >
        {user.isPortfolioDemo ? <PortfolioDemoBanner user={user} /> : null}
        {children}
      </main>

      <ResponsiveBottomNavigation
        activeView={activeView}
        onNavigate={handleNavigate}
        unreadInboxCount={unreadInboxCount}
      />
    </div>
  );
}

/** Explains the isolated, expiring behavior of the portfolio workspace. */
function PortfolioDemoBanner({ user }: { user: AuthUser }) {
  return (
    <div
      className="proof-demo-banner grid gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center"
      role="status"
    >
      <Clock3 className="h-5 w-5 text-primary" aria-hidden="true" />
      <p className="leading-6 text-muted-foreground">
        <span className="font-semibold text-foreground">Portfolio demo workspace.</span>{" "}
        Sample data is isolated and resets automatically
        {user.portfolioDemoExpiresAt
          ? ` at ${formatPortfolioDemoExpiry(user.portfolioDemoExpiresAt)}`
          : " after this session"}
        . Outbound sharing and device uploads are disabled.
      </p>
    </div>
  );
}

/** Formats the demo expiry in the product's fixed presentation locale. */
function formatPortfolioDemoExpiry(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
