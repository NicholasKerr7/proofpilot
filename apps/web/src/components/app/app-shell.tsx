"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  FolderOpen,
  Home,
  Inbox,
  LogOut,
  Menu,
  UploadCloud,
  UserRound,
  type LucideIcon
} from "lucide-react";
import { getUserInitials } from "@/components/app/account/account-utils";
import { ApiStatus } from "@/components/system/api-status";
import { Button } from "@/components/ui/button";
import type { AuthUser } from "@/lib/client/types";
import { cn } from "@/lib/utils";

export type AppView =
  | "home"
  | "cases"
  | "create"
  | "case"
  | "upload"
  | "notifications"
  | "account"
  | "reports"
  | "calendar"
  | "settings"
  | "connections"
  | "billing"
  | "help"
  | "search"
  | "more";

type PrimaryNavigationView = "home" | "cases" | "upload" | "notifications" | "more";

const navItems: Array<{
  icon: LucideIcon;
  label: string;
  view: PrimaryNavigationView;
}> = [
  { label: "Home", view: "home", icon: Home },
  { label: "Cases", view: "cases", icon: FolderOpen },
  { label: "Upload", view: "upload", icon: UploadCloud },
  { label: "Inbox", view: "notifications", icon: Inbox },
  { label: "More", view: "more", icon: Menu }
];

interface AppShellProps {
  activeView: AppView;
  children: React.ReactNode;
  onLogout: () => Promise<void>;
  onNavigate: (view: AppView) => void;
  user: AuthUser;
}

export function AppShell({ activeView, children, onLogout, onNavigate, user }: AppShellProps) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  function handleNavigate(view: AppView) {
    setIsAccountMenuOpen(false);
    onNavigate(view);
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

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-background/90 px-4 py-5 backdrop-blur lg:flex lg:flex-col">
        <ProofPilotWordmark />

        <nav className="mt-8 grid gap-1" aria-label="Primary">
          {navItems.map((item) => (
            <Button
              key={item.view}
              aria-current={isNavigationActive(activeView, item.view) ? "page" : undefined}
              className="justify-start"
              onClick={() => handleNavigate(item.view)}
              type="button"
              variant={isNavigationActive(activeView, item.view) ? "secondary" : "ghost"}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Button>
          ))}
        </nav>

        <div className="mt-auto grid gap-3 rounded-md border border-border bg-card p-4">
          <div>
            <p className="text-sm font-semibold">{user.name ?? user.email}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <ApiStatus />
          <Button onClick={() => handleNavigate("account")} type="button" variant="outline">
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Manage account
          </Button>
          <Button
            onClick={() => {
              void handleLogout();
            }}
            type="button"
            variant="outline"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </aside>

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
              <div
                aria-label="Account details"
                className="absolute right-0 top-14 z-50 grid w-72 gap-3 rounded-md border border-border bg-background p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
                id="account-popover"
                role="region"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{user.name ?? "ProofPilot user"}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <ApiStatus />
                <Button onClick={() => handleNavigate("account")} type="button" variant="outline">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                  Manage account
                </Button>
                <Button
                  onClick={() => {
                    void handleLogout();
                  }}
                  type="button"
                  variant="outline"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main
        id="proofpilot-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-[1560px] flex-col gap-5 px-4 py-4 focus:outline-none sm:px-6 md:gap-6 md:px-8 md:py-6 lg:pl-72 lg:pr-8 lg:pt-8"
      >
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 mx-auto grid max-w-3xl grid-cols-5 border-t border-border bg-background/95 px-1 pb-4 pt-2 backdrop-blur md:border-x md:px-3 lg:hidden"
        aria-label="Primary mobile"
      >
        {navItems.map((item) => {
          const isActive = isNavigationActive(activeView, item.view);

          return (
            <button
              key={item.view}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-xs",
                isActive ? "bg-secondary text-primary" : null
              )}
              onClick={() => handleNavigate(item.view)}
              type="button"
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
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

function isNavigationActive(activeView: AppView, navigationView: PrimaryNavigationView) {
  if (navigationView === "cases") {
    return activeView === "cases" || activeView === "create" || activeView === "case";
  }

  if (navigationView === "more") {
    return (
      activeView === "more" ||
      activeView === "account" ||
      activeView === "reports" ||
      activeView === "calendar" ||
      activeView === "settings" ||
      activeView === "connections" ||
      activeView === "billing" ||
      activeView === "help" ||
      activeView === "search"
    );
  }

  return activeView === navigationView;
}
