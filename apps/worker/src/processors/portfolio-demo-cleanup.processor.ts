import { getPrismaClient, type PrismaClient } from "@proofpilot/database";
import { deleteStoredObject } from "@proofpilot/storage";
import type { Job } from "bullmq";
import type { ExpirePortfolioDemoWorkspacesJobData } from "../queues/upload-cleanup.queue.js";

const portfolioDemoCleanupBatchSize = 25;
type DeleteStoredObject = typeof deleteStoredObject;

export interface PortfolioDemoCleanupResult {
  contended: number;
  deleted: number;
  examined: number;
  failed: number;
  storageObjectsDeleted: number;
}

export async function expirePortfolioDemoWorkspaces(
  _job: Job<ExpirePortfolioDemoWorkspacesJobData>
) {
  return expirePortfolioDemoWorkspaceBatch(getPrismaClient());
}

export async function expirePortfolioDemoWorkspaceBatch(
  client: PrismaClient,
  now = new Date(),
  deleteObject: DeleteStoredObject = deleteStoredObject
): Promise<PortfolioDemoCleanupResult> {
  const workspaces = await client.user.findMany({
    where: {
      isPortfolioDemo: true,
      OR: [
        { portfolioDemoExpiresAt: null },
        { portfolioDemoExpiresAt: { lte: now } }
      ]
    },
    orderBy: [{ portfolioDemoExpiresAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      portfolioDemoExpiresAt: true,
      cases: {
        select: {
          documents: {
            select: {
              storageKey: true,
              versions: { select: { storageKey: true } }
            }
          },
          packets: {
            select: {
              exports: { select: { storageKey: true } }
            }
          }
        }
      }
    },
    take: portfolioDemoCleanupBatchSize
  });
  const result: PortfolioDemoCleanupResult = {
    contended: 0,
    deleted: 0,
    examined: workspaces.length,
    failed: 0,
    storageObjectsDeleted: 0
  };

  for (const workspace of workspaces) {
    const storageKeys = collectWorkspaceStorageKeys(workspace.cases);
    let storageCleanupFailed = false;

    for (const key of storageKeys) {
      try {
        await deleteObject({ key });
        result.storageObjectsDeleted += 1;
      } catch {
        storageCleanupFailed = true;
        break;
      }
    }

    if (storageCleanupFailed) {
      result.failed += 1;
      continue;
    }

    const deleted = await client.user.deleteMany({
      where: {
        id: workspace.id,
        isPortfolioDemo: true,
        portfolioDemoExpiresAt: workspace.portfolioDemoExpiresAt
      }
    });

    if (deleted.count) {
      result.deleted += 1;
    } else {
      result.contended += 1;
    }
  }

  return result;
}

function collectWorkspaceStorageKeys(
  cases: Array<{
    documents: Array<{
      storageKey: string;
      versions: Array<{ storageKey: string }>;
    }>;
    packets: Array<{ exports: Array<{ storageKey: string }> }>;
  }>
) {
  const keys = new Set<string>();

  for (const caseRecord of cases) {
    for (const document of caseRecord.documents) {
      addWorkspaceStorageKey(keys, document.storageKey);
      document.versions.forEach((version) =>
        addWorkspaceStorageKey(keys, version.storageKey)
      );
    }

    for (const packet of caseRecord.packets) {
      packet.exports.forEach((packetExport) =>
        addWorkspaceStorageKey(keys, packetExport.storageKey)
      );
    }
  }

  return [...keys];
}

function addWorkspaceStorageKey(keys: Set<string>, storageKey: string) {
  if (!storageKey.startsWith("demo-samples/")) {
    keys.add(storageKey);
  }
}
