export interface RequestUser {
  id: string;
  email: string;
  sessionId: string;
  isPortfolioDemo: boolean;
  portfolioDemoExpiresAt: Date | null;
}
