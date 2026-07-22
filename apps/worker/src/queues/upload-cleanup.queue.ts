export const uploadCleanupQueueName = "upload-cleanup";

export type ExpireAbandonedUploadsJobData = Record<string, never>;
export type ExpirePortfolioDemoWorkspacesJobData = Record<string, never>;
export type UploadCleanupJobData =
  | ExpireAbandonedUploadsJobData
  | ExpirePortfolioDemoWorkspacesJobData;
