export const packetSharePermissions = ["VIEW", "COMMENT", "DOWNLOAD"] as const;
export type PacketSharePermission = (typeof packetSharePermissions)[number];

export interface PacketShareCapabilities {
  comments: boolean;
  emailDelivery: boolean;
  emailVerification: boolean;
  watermarking: boolean;
}

export interface PacketSharePacketSummary {
  byteSize: number | null;
  createdAt: string;
  exportId: string;
  packetId: string;
  title: string;
}

export interface PacketShareSuggestedRecipient {
  email: string;
  name: string | null;
}

export interface PacketShareActiveRecord {
  createdAt: string;
  expiresAt: string | null;
  id: string;
  recipientCount: number;
}

export interface PacketSharePreparationResponse {
  activeShares: PacketShareActiveRecord[];
  capabilities: PacketShareCapabilities;
  packet: PacketSharePacketSummary | null;
  suggestedRecipients: PacketShareSuggestedRecipient[];
}

export interface CreatePacketShareRecipientInput {
  email: string;
  permission: PacketSharePermission;
}

export interface CreatePacketShareInput {
  expiresAt?: string | null;
  packetExportId: string;
  recipients: CreatePacketShareRecipientInput[];
  requireEmailVerification: boolean;
  watermarkDocuments: boolean;
}

export interface PacketShareRecipientRecord {
  email: string;
  id: string;
  lastAccessedAt: string | null;
  permission: PacketSharePermission;
}

export interface PacketShareCreatedResponse {
  capabilities: PacketShareCapabilities;
  createdAt: string;
  deliveryMode: "LINK_ONLY";
  expiresAt: string | null;
  id: string;
  ownerDownloadUrl: string;
  packet: PacketSharePacketSummary;
  recipients: PacketShareRecipientRecord[];
  requireEmailVerification: boolean;
  shareUrl: string;
  watermarkDocuments: boolean;
}

export interface PacketShareRevokedResponse {
  id: string;
  revokedAt: string;
}

export interface PublicPacketShareMetadata {
  expiresAt: string | null;
  requireEmailVerification: boolean;
}

export interface AccessPacketShareInput {
  email: string;
  token: string;
}

export interface PacketShareTokenInput {
  token: string;
}

export interface PacketShareAccessResponse {
  accessToken: string;
  expiresAt: string;
  permission: PacketSharePermission;
}

export interface PacketShareCommentRecord {
  content: string;
  createdAt: string;
  id: string;
  isOwn: boolean;
}

export interface PacketShareContentResponse {
  comments: PacketShareCommentRecord[];
  downloadUrl: string | null;
  packet: Pick<PacketSharePacketSummary, "byteSize" | "createdAt" | "title">;
  permission: PacketSharePermission;
  viewUrl: string;
}

export interface CreatePacketShareCommentInput {
  content: string;
  token: string;
}
