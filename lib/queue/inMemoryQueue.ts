import { dispatchBackgroundJobSafely } from "@/lib/queue/dispatch";
import { logger } from "@/lib/logger";
import type {
  EnqueueJobOptions,
  JobName,
  JobPayloadByName,
} from "@/lib/queue/types";
import {
  safeSlackAiRequestJobMetadata,
  safeSlackInteractivityJobMetadata,
} from "@/lib/queue/types";

const seenIdempotencyKeys = new Set<string>();

/**
 * LOCAL DEV / TEST ONLY: in-process queue. Jobs are lost on process restart.
 * Set QUEUE_ADAPTER=in-memory explicitly for this path.
 */
export async function enqueueInMemoryJob<TName extends JobName>(
  name: TName,
  payload: JobPayloadByName[TName],
  options: EnqueueJobOptions = {},
): Promise<void> {
  if (options.idempotencyKey) {
    if (seenIdempotencyKeys.has(options.idempotencyKey)) {
      logger.info(
        {
          jobName: name,
          idempotencyKey: options.idempotencyKey,
          duplicate: true,
        },
        "Skipped duplicate in-memory background job",
      );
      return;
    }

    seenIdempotencyKeys.add(options.idempotencyKey);
  }

  logger.info(
    {
      jobName: name,
      adapter: "in-memory",
      ...(name === "slack.ai_request"
        ? safeSlackAiRequestJobMetadata(payload as JobPayloadByName["slack.ai_request"])
        : safeSlackInteractivityJobMetadata(
            payload as JobPayloadByName["slack.interactivity"],
          )),
    },
    "Enqueuing background job",
  );

  setImmediate(() => {
    void dispatchBackgroundJobSafely(name, payload).catch(() => {
      // Errors are logged inside dispatchBackgroundJobSafely.
    });
  });
}

/** Test helper to reset idempotency tracking between cases. */
export function resetInMemoryQueueForTests(): void {
  seenIdempotencyKeys.clear();
}
