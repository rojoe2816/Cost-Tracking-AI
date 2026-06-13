import "server-only";

import { env } from "@/lib/env";
import { enqueueInMemoryJob } from "@/lib/queue/inMemoryQueue";
import { enqueuePostgresJob } from "@/lib/queue/postgresQueue";
import type {
  EnqueueJobOptions,
  JobName,
  JobPayloadByName,
} from "@/lib/queue/types";

export type { EnqueueJobOptions, JobName, JobPayloadByName };
export type {
  SlackAiRequestJobPayload,
  SlackInteractivityJobPayload,
} from "@/lib/queue/types";

function resolveQueueAdapter(): "in-memory" | "postgres" {
  if (env.QUEUE_ADAPTER) {
    return env.QUEUE_ADAPTER;
  }

  return env.NODE_ENV === "test" ? "in-memory" : "postgres";
}

/**
 * Schedules a background job and returns quickly.
 *
 * Slack routes should call this and return HTTP 200 immediately. Expensive
 * work runs in a separate worker when QUEUE_ADAPTER=postgres.
 *
 * QUEUE_ADAPTER=in-memory is local/test only and not durable.
 */
export async function enqueueJob<TName extends JobName>(
  name: TName,
  payload: JobPayloadByName[TName],
  options: EnqueueJobOptions = {},
): Promise<void> {
  const adapter = resolveQueueAdapter();

  if (adapter === "in-memory") {
    await enqueueInMemoryJob(name, payload, options);
    return;
  }

  await enqueuePostgresJob(name, payload, options);
}

export { getRecentBackgroundJobs } from "@/lib/queue/postgresQueue";
