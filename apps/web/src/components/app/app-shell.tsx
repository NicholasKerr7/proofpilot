"use client";

import { FileCheck2, FolderOpen, LogOut, ShieldCheck, UploadCloud, Clock3 } from "lucide-react";
import { ApiStatus } from "@/components/system/api-status";
import { Button } from "@/components/ui/button";
import type { AuthUser } from "@/lib/client/types";

const navItems = [
  { label: "Dashboard", icon: FolderOpen },
  { label: "Evidence", icon: UploadCloud },
  { label: "Timeline", icon: Clock3 },
  { label: "Packet", icon: FileCheck2 }
];

interface AppShellProps {
  children: React.ReactNode;
  user: AuthUser;
  onLogout: () => void;
}

export function AppShell({ children, user, onLogout }: AppShellProps) {
  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <a
        href="#proofpilot-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        Skip to workspace
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-background/82 px-4 py-5 backdrop-blur lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/35 bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">ProofPilot</p>
            <p className="text-xs text-muted-foreground">Case Packet Automation</p>
          </div>
        </div>

        <nav className="mt-8 grid gap-1" aria-label="Primary">
          {navItems.map((item, index) => (
            <Button
              key={item.label}
              type="button"
              variant={index === 0 ? "secondary" : "ghost"}
              className="justify-start"
              aria-current={index === 0 ? "page" : undefined}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Button>
          ))}
        </nav>

        <div className="mt-auto grid gap-3 rounded-lg border border-border bg-card p-4">
          <div>
            <p className="text-sm font-semibold">{user.name ?? user.email}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <Button type="button" variant="outline" onClick={onLogout}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-border bg-background/82 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-primary/35 bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold">ProofPilot</p>
              <p className="max-w-36 truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <ApiStatus />
        </div>
      </header>

      <main
        id="proofpilot-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-[1560px] flex-col gap-5 px-4 py-4 focus:outline-none sm:px-6 lg:pl-72 lg:pr-8 lg:pt-8"
      >
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-border bg-background/92 px-2 pb-3 pt-2 backdrop-blur lg:hidden"
        aria-label="Primary mobile"
      >
        {navItems.map((item, index) => (
          <button
            key={item.label}
            type="button"
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-secondary data-[active=true]:text-foreground"
            data-active={index === 0}
            aria-current={index === 0 ? "page" : undefined}
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
