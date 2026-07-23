"use client";

import { useEffect, useState } from "react";
import type { AccountConnection, ConnectionProvider } from "@proofpilot/types";
import {
  CheckCircle2,
  Cloud,
  CloudCog,
  LoaderCircle,
  ShieldCheck
} from "lucide-react";
import { ConnectionRow } from "@/components/app/connections/connection-row";
import { createEmptyConnectionCatalog } from "@/components/app/connections/connection-utils";
import { apiRequest } from "@/lib/client/api";
import { cn } from "@/lib/utils";

type Notice = {
  tone: "error" | "success";
  text: string;
};

export function ConnectedAccountsPanel() {
  const [connections, setConnections] = useState<AccountConnection[] | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<ConnectionProvider | null>(null);
  const [confirmingProvider, setConfirmingProvider] = useState<ConnectionProvider | null>(null);
  const [busyProvider, setBusyProvider] = useState<ConnectionProvider | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadConnections() {
      try {
        const nextConnections = await apiRequest<AccountConnection[]>("/api/connections");
        if (isMounted) {
          setNow(Date.now());
          setConnections(nextConnections);
        }
      } catch (error) {
        if (isMounted) {
          setNow(Date.now());
          setConnections(createEmptyConnectionCatalog());
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : "Connections could not be loaded."
          });
        }
      }
    }

    void loadConnections();

    return () => {
      isMounted = false;
    };
  }, []);

  async function connect(provider: ConnectionProvider) {
    setBusyProvider(provider);
    setNotice(null);

    try {
      const updatedConnection = await apiRequest<AccountConnection>(
        `/api/connections/${provider}`,
        { method: "POST" }
      );
      replaceConnection(updatedConnection);
      setNotice({ tone: "success", text: "Account connected." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Account could not be connected."
      });
    } finally {
      setBusyProvider(null);
    }
  }

  async function disconnect(provider: ConnectionProvider) {
    setBusyProvider(provider);
    setNotice(null);

    try {
      const updatedConnection = await apiRequest<AccountConnection>(
        `/api/connections/${provider}`,
        { method: "DELETE" }
      );
      replaceConnection(updatedConnection);
      setExpandedProvider(null);
      setConfirmingProvider(null);
      setNotice({ tone: "success", text: "Connection access revoked." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Access could not be revoked."
      });
    } finally {
      setBusyProvider(null);
    }
  }

  function replaceConnection(updatedConnection: AccountConnection) {
    setConnections((currentConnections) =>
      (currentConnections ?? createEmptyConnectionCatalog()).map((connection) =>
        connection.provider === updatedConnection.provider ? updatedConnection : connection
      )
    );
  }

  function toggleAccess(provider: ConnectionProvider) {
    setExpandedProvider((currentProvider) =>
      currentProvider === provider ? null : provider
    );
    setConfirmingProvider(null);
  }

  return (
    <section aria-labelledby="connected-accounts-heading" className="grid gap-5">
      <div className="proof-page-header grid gap-4 md:grid-cols-[minmax(0,1fr)_24rem] md:items-end">
        <div>
          <p className="text-sm font-semibold text-primary">Account integrations</p>
          <h1
            className="mt-1 text-2xl font-semibold sm:text-3xl"
            id="connected-accounts-heading"
          >
            Connected Accounts
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            Manage your linked services and integrations.
          </p>
        </div>

        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-primary/25 bg-card p-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-md border border-primary/35 bg-primary/10 text-primary">
            <Cloud className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-primary">Your connections are secure</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Connection metadata is private to your account and protected by workspace access controls.
            </p>
          </div>
        </div>
      </div>

      {notice ? (
        <div
          className={cn(
            "flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm",
            notice.tone === "error"
              ? "border-red-400/30 bg-red-400/10 text-red-100"
              : "border-teal-400/30 bg-teal-400/10 text-teal-100"
          )}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.tone === "error" ? (
            <CloudCog className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{notice.text}</span>
        </div>
      ) : null}

      <div className="rounded-md border border-border bg-card p-3 sm:p-4 md:p-5">
        <div className="px-1 pb-4">
          <h2 className="text-sm font-semibold uppercase text-primary">Linked services</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Connect accounts for evidence imports and case workflows.
          </p>
        </div>

        {connections ? (
          <div className="overflow-hidden rounded-md border border-border">
            {connections.map((connection, index) => (
              <ConnectionRow
                busy={busyProvider === connection.provider}
                confirming={confirmingProvider === connection.provider}
                connection={connection}
                expanded={expandedProvider === connection.provider}
                key={connection.provider}
                last={index === connections.length - 1}
                now={now}
                onCancelDisconnect={() => setConfirmingProvider(null)}
                onConnect={() => {
                  void connect(connection.provider);
                }}
                onConfirmDisconnect={() => {
                  void disconnect(connection.provider);
                }}
                onRequestDisconnect={() => setConfirmingProvider(connection.provider)}
                onToggleAccess={() => toggleAccess(connection.provider)}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-40 items-center justify-center gap-3 rounded-md border border-border text-sm text-muted-foreground">
            <LoaderCircle className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            Loading linked services...
          </div>
        )}

        <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-md border border-primary/20 bg-secondary/20 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Your data stays private and secure.</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Provider content is imported only after permission is granted, and access can be revoked here at any time.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
