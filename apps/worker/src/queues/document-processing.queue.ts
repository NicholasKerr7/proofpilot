export const documentProcessingQueueName = "document-processing";

export interface ProcessDocumentJobData {
  documentId: string;
  caseId: string;
  ownerId: string;
}
