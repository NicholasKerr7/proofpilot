import Image from "next/image";
import type { AccountConnection } from "@proofpilot/types";
import { ChevronDown, LoaderCircle, Unplug } from "lucide-react";
import {
  connectionProviderPresentation,
  formatLastSync
} from "@/components/app/connections/connection-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConnectionRowProps {
  busy: boolean;
  confirming: boolean;
  connection: AccountConnection;
  expanded: boolean;
  last: boolean;
  now: number | null;
  onCancelDisconnect: () => void;
  onConnect: () => void;
  onConfirmDisconnect: () => void;
  onRequestDisconnect: () => void;
  onToggleAccess: () => void;
}

export function ConnectionRow({
  busy,
  confirming,
  connection,
  expanded,
  last,
  now,
  onCancelDisconnect,
  onConnect,
  onConfirmDisconnect,
  onRequestDisconnect,
  onToggleAccess
}: ConnectionRowProps) {
  const presentation = connectionProviderPresentation[connection.provider];
  const isConnected = connection.status === "CONNECTED";
  const detailsId = `connection-details-${connection.provider.toLowerCase()}`;

  return (
    <div className={cn(!last ? "border-b border-border" : null)}>
      <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 p-3 min-[360px]:grid-cols-[3.25rem_minmax(0,1fr)_auto] sm:grid-cols-[4rem_minmax(0,1fr)_minmax(9rem,0.55fr)_auto] sm:p-4 md:gap-x-5">
        <span className="flex h-13 w-13 items-center justify-center rounded-md border border-primary/35 bg-background/65 p-2 sm:h-16 sm:w-16 sm:p-3">
          <Image
            alt=""
            className="h-full w-full object-contain"
            height={48}
            src={presentation.logoSrc}
            unoptimized
            width={48}
          />
        </span>

        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold text-foreground sm:text-base">
            {presentation.label}
          </h3>
          <p className="mt-1 hidden max-w-md text-xs leading-5 text-muted-foreground sm:block">
            {presentation.description}
          </p>
          <Badge className="mt-2 hidden sm:inline-flex" variant="secondary">
            {presentation.capability}
          </Badge>
          <ConnectionStatus
            className="mt-1 sm:hidden"
            connection={connection}
            now={now}
          />
        </div>

        <ConnectionStatus
          className="hidden border-l border-border pl-4 sm:block"
          connection={connection}
          now={now}
        />

        {isConnected ? (
          <Button
            aria-controls={detailsId}
            aria-expanded={expanded}
            className="col-span-2 w-full min-w-24 px-3 min-[360px]:col-span-1 min-[360px]:w-auto sm:min-w-36"
            disabled={busy}
            onClick={onToggleAccess}
            type="button"
            variant="outline"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            <span className="sm:hidden">Manage</span>
            <span className="hidden sm:inline">Manage access</span>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", expanded ? "rotate-180" : null)}
              aria-hidden="true"
            />
          </Button>
        ) : (
          <Button
            className="col-span-2 w-full min-w-24 px-3 min-[360px]:col-span-1 min-[360px]:w-auto sm:min-w-36"
            disabled={busy}
            onClick={onConnect}
            type="button"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Connect
          </Button>
        )}
      </div>

      {expanded && isConnected ? (
        <div
          className="grid gap-4 border-t border-border bg-secondary/20 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-center sm:px-5"
          id={detailsId}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Account</p>
            <p className="mt-1 break-all text-sm text-foreground">
              {connection.accountLabel ?? "Account label unavailable"}
            </p>
            {connection.mode === "DEMO" ? (
              <Badge className="mt-2" variant="warning">
                Demo metadata only
              </Badge>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Access</p>
            <p className="mt-1 text-sm leading-5 text-foreground">{presentation.permission}</p>
            {connection.mode === "DEMO" ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                No third-party authorization token is stored for this demo connection.
              </p>
            ) : null}
          </div>
          <div className="sm:min-w-44">
            {confirming ? (
              <div className="grid gap-2">
                <p className="text-xs text-red-100">Revoke this connection?</p>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={busy}
                    onClick={onCancelDisconnect}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 border border-red-400/35 bg-red-500/15 text-red-100 shadow-none hover:bg-red-500/25"
                    disabled={busy}
                    onClick={onConfirmDisconnect}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {busy ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Unplug className="h-4 w-4" aria-hidden="true" />
                    )}
                    Revoke
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full border-red-400/25 text-red-100 hover:bg-red-500/10"
                onClick={onRequestDisconnect}
                type="button"
                variant="outline"
              >
                <Unplug className="h-4 w-4" aria-hidden="true" />
                Revoke access
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface ConnectionStatusProps {
  className?: string;
  connection: AccountConnection;
  now: number | null;
}

function ConnectionStatus({ className, connection, now }: ConnectionStatusProps) {
  const isConnected = connection.status === "CONNECTED";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "h-2.5 w-2.5 shrink-0 rounded-full",
            isConnected ? "bg-emerald-400" : "bg-muted-foreground"
          )}
          aria-hidden="true"
        />
        <span className={cn("text-sm", isConnected ? "text-emerald-300" : "text-foreground")}>
          {isConnected ? "Connected" : "Not connected"}
        </span>
        {connection.mode === "DEMO" ? <Badge variant="secondary">Demo</Badge> : null}
      </div>
      <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
        {isConnected ? formatLastSync(connection.lastSyncedAt, now) : "Connect to start syncing"}
      </p>
    </div>
  );
}
