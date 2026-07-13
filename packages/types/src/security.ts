export interface SecurityLoginActivity {
  deviceLabel: string;
  id: string;
  isLatest: boolean;
  locationLabel: string;
  occurredAt: string;
}

export interface SecurityCapabilities {
  biometricEnrollment: boolean;
  sessionRevocation: boolean;
  twoFactorEnrollment: boolean;
}

export interface SecurityOverview {
  biometricEnabled: boolean;
  capabilities: SecurityCapabilities;
  loginActivity: SecurityLoginActivity[];
  passwordChangedAt: string;
  twoFactorEnabled: boolean;
}
