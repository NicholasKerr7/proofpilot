import type { JobType, Queue } from "bullmq";

const queueJobCountTypes = [
  "active",
  "completed",
  "delayed",
  "failed",
  "paused",
  "prioritized",
  "waiting",
  "waiting-children"
] as const satisfies readonly JobType[];

type QueueJobCountType = (typeof queueJobCountTypes)[number];

export interface QueueHealthSnapshot {
  counts: Record<QueueJobCountType, number>;
  name: string;
  paused: boolean;
  status: "ok" | "degraded";
}

export async function getQueueHealthSnapshot(queue: Queue, name: string): Promise<QueueHealthSnapshot> {
  const [rawCounts, paused] = await Promise.all([
    queue.getJobCounts(...queueJobCountTypes),
    queue.isPaused()
  ]);
  const counts = Object.fromEntries(
    queueJobCountTypes.map((jobType) => [jobType, rawCounts[jobType] ?? 0])
  ) as Record<QueueJobCountType, number>;

  return {
    counts,
    name,
    paused,
    status: paused || counts.failed > 0 ? "degraded" : "ok"
  };
}
