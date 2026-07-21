export const caseCollaboratorRoles = ["EDITOR", "VIEWER"] as const;
export type CaseCollaboratorRole = (typeof caseCollaboratorRoles)[number];

export const caseAccessRoles = ["OWNER", ...caseCollaboratorRoles] as const;
export type CaseAccessRole = (typeof caseAccessRoles)[number];

export const caseCollaboratorStatuses = ["ACTIVE", "PENDING", "EXPIRED"] as const;
export type CaseCollaboratorStatus = (typeof caseCollaboratorStatuses)[number];

export const caseInvitationExpiryOptions = [1, 3, 7, 14, 30] as const;
export type CaseInvitationExpiryDays = (typeof caseInvitationExpiryOptions)[number];

export const caseCollaborationActivityActions = [
  "INVITED",
  "ACCEPTED",
  "DECLINED",
  "ROLE_UPDATED",
  "REMOVED",
  "SETTINGS_UPDATED"
] as const;
export type CaseCollaborationActivityAction =
  (typeof caseCollaborationActivityActions)[number];

export interface CaseCollaborationOwner {
  email: string;
  name: string | null;
}

export interface CaseCollaboratorRecord {
  acceptedAt: string | null;
  email: string;
  expiresAt: string | null;
  id: string;
  invitedAt: string;
  name: string | null;
  role: CaseCollaboratorRole;
  status: CaseCollaboratorStatus;
}

export interface CaseCollaborationSettings {
  accessLogging: boolean;
  invitationExpiryDays: CaseInvitationExpiryDays;
  preventDownloads: boolean;
  secureSharing: boolean;
}

export interface CaseCollaborationActivityRecord {
  action: CaseCollaborationActivityAction;
  actorName: string;
  createdAt: string;
  detail: string;
  id: string;
}

export interface CaseCollaborationResponse {
  activity: CaseCollaborationActivityRecord[];
  collaborators: CaseCollaboratorRecord[];
  owner: CaseCollaborationOwner;
  seatLimit: number;
  seatsUsed: number;
  settings: CaseCollaborationSettings;
}

export interface CaseAccess {
  canDownload: boolean;
  canEdit: boolean;
  canManage: boolean;
  role: CaseAccessRole;
}

export interface CaseInvitationPreview {
  caseTitle: string;
  expiresAt: string;
  invitedEmail: string;
  ownerName: string;
  role: CaseCollaboratorRole;
  status: "EXPIRED" | "PENDING";
}

export interface CaseInvitationDecisionResponse {
  caseId: string | null;
  caseTitle: string;
  message: string;
  ok: true;
  role: CaseCollaboratorRole;
}

export interface InviteCaseCollaboratorInput {
  email: string;
  role: CaseCollaboratorRole;
}

export interface UpdateCaseCollaboratorInput {
  role: CaseCollaboratorRole;
}

export interface UpdateCaseCollaborationSettingsInput {
  invitationExpiryDays?: CaseInvitationExpiryDays;
  preventDownloads?: boolean;
}
