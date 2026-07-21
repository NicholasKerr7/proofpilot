"use client";

import { type FormEvent, useState } from "react";
import { Trash2, UserPlus, X } from "lucide-react";
import type {
  CaseCollaborationOwner,
  CaseCollaboratorRecord,
  CaseCollaboratorRole,
  InviteCaseCollaboratorInput
} from "@proofpilot/types";
import {
  formatCollaboratorStatus,
  getCollaboratorInitials,
  getCollaboratorStatusVariant
} from "@/components/app/collaboration/collaboration-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface CollaboratorRosterProps {
  collaborators: CaseCollaboratorRecord[];
  owner: CaseCollaborationOwner;
  pendingAction: string | null;
  seatLimit: number;
  seatsUsed: number;
  onInvite: (input: InviteCaseCollaboratorInput) => Promise<boolean>;
  onRemove: (collaboratorId: string) => Promise<boolean>;
  onRoleChange: (collaboratorId: string, role: CaseCollaboratorRole) => Promise<void>;
}

export function CollaboratorRoster({
  collaborators,
  owner,
  pendingAction,
  seatLimit,
  seatsUsed,
  onInvite,
  onRemove,
  onRoleChange
}: CollaboratorRosterProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CaseCollaboratorRole>("VIEWER");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const didInvite = await onInvite({ email, role });

    if (didInvite) {
      setEmail("");
      setRole("VIEWER");
    }
  }

  return (
    <Card>
      <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-center p-4 pb-3">
        <CardTitle className="text-sm uppercase text-primary">Collaborators</CardTitle>
        <span className="text-xs text-muted-foreground">
          {seatsUsed} of {seatLimit} seats used
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border border-y border-border">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
            <CollaboratorAvatar email={owner.email} name={owner.name} tone="owner" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{owner.name ?? "Case owner"}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{owner.email}</p>
            </div>
            <Badge>Owner</Badge>
          </div>

          {collaborators.map((collaborator) => {
            const isRemoving = pendingAction === `remove:${collaborator.id}`;
            const isUpdatingRole = pendingAction === `role:${collaborator.id}`;
            const isExpired = collaborator.status === "EXPIRED";

            return (
              <div className="px-4 py-3" key={collaborator.id}>
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                  <CollaboratorAvatar
                    email={collaborator.email}
                    name={collaborator.name}
                    tone={collaborator.role === "EDITOR" ? "editor" : "viewer"}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {collaborator.name ?? collaborator.email}
                      </p>
                      <Badge variant={getCollaboratorStatusVariant(collaborator.status)}>
                        {formatCollaboratorStatus(collaborator.status)}
                      </Badge>
                    </div>
                    {collaborator.name ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {collaborator.email}
                      </p>
                    ) : null}
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
                    <Label className="sr-only" htmlFor={`collaborator-role-${collaborator.id}`}>
                      Role for {collaborator.name ?? collaborator.email}
                    </Label>
                    <Select
                      aria-label={`Role for ${collaborator.name ?? collaborator.email}`}
                      className="h-11 min-h-11 w-28 text-xs"
                      disabled={Boolean(pendingAction) || isExpired}
                      id={`collaborator-role-${collaborator.id}`}
                      onChange={(event) => {
                        void onRoleChange(
                          collaborator.id,
                          event.target.value as CaseCollaboratorRole
                        );
                      }}
                      value={collaborator.role}
                    >
                      <option value="EDITOR">Editor</option>
                      <option value="VIEWER">Viewer</option>
                    </Select>
                    <Button
                      aria-label={`Remove ${collaborator.name ?? collaborator.email}`}
                      disabled={Boolean(pendingAction)}
                      onClick={() => setConfirmRemoveId(collaborator.id)}
                      size="icon"
                      title="Remove collaborator"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {confirmRemoveId === collaborator.id ? (
                  <div className="mt-3 grid gap-2 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-100 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                    <span>
                      Remove {collaborator.name ?? collaborator.email} from this case?
                    </span>
                    <Button
                      disabled={isRemoving}
                      onClick={() => setConfirmRemoveId(null)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      disabled={isRemoving}
                      onClick={() => {
                        void onRemove(collaborator.id).then((didRemove) => {
                          if (didRemove) {
                            setConfirmRemoveId(null);
                          }
                        });
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      {isRemoving ? "Removing..." : "Remove"}
                    </Button>
                  </div>
                ) : null}

                {isUpdatingRole ? (
                  <p className="mt-2 text-right text-xs text-muted-foreground">
                    Updating role...
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <form
          className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_7.5rem_auto] sm:items-end"
          onSubmit={(event) => {
            void handleInvite(event);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="collaborator-email">Invite a collaborator</Label>
            <Input
              autoComplete="email"
              disabled={pendingAction === "invite"}
              id="collaborator-email"
              maxLength={254}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="advisor@example.com"
              required
              type="email"
              value={email}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invitation-role">Role</Label>
            <Select
              disabled={pendingAction === "invite"}
              id="invitation-role"
              onChange={(event) => setRole(event.target.value as CaseCollaboratorRole)}
              value={role}
            >
              <option value="VIEWER">Viewer</option>
              <option value="EDITOR">Editor</option>
            </Select>
          </div>
          <Button disabled={Boolean(pendingAction)} type="submit">
            <UserPlus aria-hidden="true" className="h-4 w-4" />
            {pendingAction === "invite" ? "Inviting..." : "Invite"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CollaboratorAvatar({
  email,
  name,
  tone
}: {
  email: string;
  name: string | null;
  tone: "editor" | "owner" | "viewer";
}) {
  const toneClass =
    tone === "owner"
      ? "border-primary/55 bg-primary/10 text-primary"
      : tone === "editor"
        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
        : "border-violet-400/40 bg-violet-400/10 text-violet-200";

  return (
    <span
      aria-hidden="true"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${toneClass}`}
    >
      {getCollaboratorInitials(name, email)}
    </span>
  );
}
