import "server-only";

import { handleSlackAiRequestJob } from "@/lib/jobs/handlers/slackAiRequest";
import { logger } from "@/lib/logger";
import { handleSlackInteractivityJob } from "@/lib/slack/interactivity";
import type { JobName, JobPayloadByName } from "@/lib/queue/types";

export async function dispatchBackgroundJob<TName extends JobName>(
  name: TName,
  payload: JobPayloadByName[TName],
): Promise<void> {
  switch (name) {
    case "slack.ai_request":
      await handleSlackAiRequestJob(payload as JobPayloadByName["slack.ai_request"]);
      return;
    case "slack.interactivity":
      await handleSlackInteractivityJob(
        payload as JobPayloadByName["slack.interactivity"],
      );
      return;
    default: {
      const exhaustiveCheck: never = name;
      throw new Error(`Unsupported job name: ${String(exhaustiveCheck)}`);
    }
  }
}

export async function dispatchBackgroundJobSafely<TName extends JobName>(
  name: TName,
  payload: JobPayloadByName[TName],
  jobId?: string,
): Promise<void> {
  try {
    await dispatchBackgroundJob(name, payload);
  } catch (error) {
    logger.error(
      {
        err: error,
        jobId,
        jobName: name,
      },
      "Background job failed",
    );
    throw error;
  }
}
