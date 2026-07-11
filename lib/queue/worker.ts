import "server-only";

import { randomUUID } from "node:crypto";

import { logger } from "@/lib/logger";
import { recordWorkerHeartbeat } from "@/lib/public-api/health";
import {
  claimNextPostgresJob,
  processClaimedPostgresJob,
} from "@/lib/queue/postgresQueue";

export type WorkerLoopOptions = {
  workerId?: string;
  pollIntervalMs?: number;
  maxJobsPerTick?: number;
  signal?: AbortSignal;
};

export async function runWorkerOnce(
  workerId = `worker-${randomUUID()}`,
): Promise<number> {
  const job = await claimNextPostgresJob(workerId);

  if (!job) {
    return 0;
  }

  logger.info(
    {
      jobId: job.id,
      jobType: job.type,
      attempts: job.attempts,
      workerId,
    },
    "Processing durable background job",
  );

  await processClaimedPostgresJob(job);
  return 1;
}

export async function runWorkerLoop(
  options: WorkerLoopOptions = {},
): Promise<void> {
  const workerId = options.workerId ?? `worker-${randomUUID()}`;
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  const maxJobsPerTick = options.maxJobsPerTick ?? 5;

  logger.info({ workerId, pollIntervalMs }, "Starting durable background worker");

  while (!options.signal?.aborted) {
    try {
      let processed = 0;

      for (let index = 0; index < maxJobsPerTick; index += 1) {
        const count = await runWorkerOnce(workerId);
        processed += count;

        if (count === 0) {
          break;
        }
      }

      await recordWorkerHeartbeat(workerId);

      if (processed === 0) {
        await sleep(pollIntervalMs);
      }
    } catch (error) {
      logger.error(
        {
          workerId,
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorCode:
            error && typeof error === "object" && "code" in error
              ? String(error.code)
              : undefined,
        },
        "Background worker poll failed; retrying",
      );
      await sleep(pollIntervalMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
