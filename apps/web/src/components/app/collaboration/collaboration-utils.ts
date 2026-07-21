import type {
  CaseCollaborationActivityAction,
  CaseCollaboratorStatus
} from "@proofpilot/types";

export function getCollaboratorInitials(name: string | null, email: string) {
  const source = name?.trim() || email.split("@")[0] || "PP";
  const words = source.split(/[\s._-]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export function formatCollaboratorStatus(status: CaseCollaboratorStatus) {
  if (status === "ACTIVE") return "Active";
  if (status === "PENDING") return "Pending";
  return "Expired";
}

export function getCollaboratorStatusVariant(status: CaseCollaboratorStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "PENDING") return "warning" as const;
  return "secondary" as const;
}

export function formatCollaborationDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function getCollaborationActivityLabel(action: CaseCollaborationActivityAction) {
  if (action === "ACCEPTED") return "Invitation accepted";
  if (action === "DECLINED") return "Invitation declined";
  if (action === "INVITED") return "Invitation created";
  if (action === "ROLE_UPDATED") return "Role updated";
  if (action === "REMOVED") return "Collaborator removed";
  return "Sharing controls updated";
}
