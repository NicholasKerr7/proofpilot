export interface SecuritySession {
  createdAt: string;
  deviceLabel: string;
  expiresAt: string;
  id: string;
  isCurrent: boolean;
  lastSeenAt: string;
  locationLabel: string;
}

export interface SecurityCapabilities {
  biometricEnrollment: boolean;
  sessionRevocation: boolean;
  twoFactorEnrollment: boolean;
}

export interface SecurityOverview {
  biometricEnabled: boolean;
  capabilities: SecurityCapabilities;
  passwordChangedAt: string;
  sessions: SecuritySession[];
  twoFactorEnabled: boolean;
}

export interface SessionRevocationResponse {
  ok: true;
  revokedCount: number;
}
