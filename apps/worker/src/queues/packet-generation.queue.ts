export const packetGenerationQueueName = "packet-generation";

export interface GeneratePacketJobData {
  packetId: string;
  caseId: string;
  ownerId: string;
}
