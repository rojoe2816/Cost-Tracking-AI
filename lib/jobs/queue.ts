import { logger } from "@/lib/logger";
import { handleSlackAiRequestJob } from "@/lib/jobs/handlers/slackAiRequest";
import type { SlackMappingStatus } from "@/lib/slack/attribution";

/**
 * Background job abstraction for Slack AI request processing.
 *
 * Slack requires a fast HTTP 2xx acknowledgment, typically within 3 seconds.
 * Expensive model calls (LiteLLM, providers) must happen outside the Slack
 * request lifecycle. Route handlers should only call:
 *
 *   await enqueueJob("slack.ai_request", payload);
 *
 * and then return their HTTP response immediately.
 *
 * LOCAL DEV ONLY: this in-process queue exists for local development and MVP
 * wiring. It is not durable — jobs are lost if the process crashes or
 * restarts, and it does not work across serverless invocations. Replace it
 * with Inngest, Trigger.dev, BullMQ, SQS, or a dedicated worker before
 * production use.
 */

export type JobName = "slack.ai_request";

export type SlackAiRequestJobPayload = {
  organizationId: string;
  slackTeamId: string;
  slackChannelId: string;
  slackUserId: string;
  text: string;
  threadTs?: string;
  messageTs?: string;
  clientId?: string | null;
  projectId?: string | null;
  workflowTypeId?: string | null;
  mappingStatus?: SlackMappingStatus;
  aiRequestAuditId?: string;
};

type JobPayloadByName = {
  "slack.ai_request": SlackAiRequestJobPayload;
};

function safeJobMetadata(payload: SlackAiRequestJobPayload) {
  return {
    organizationId: payload.organizationId,
    slackTeamId: payload.slackTeamId,
    slackChannelId: payload.slackChannelId,
    slackUserId: payload.slackUserId,
    hasThreadTs: Boolean(payload.threadTs),
    hasMessageTs: Boolean(payload.messageTs),
    textLength: payload.text.length,
    mappingStatus: payload.mappingStatus,
    hasClientId: Boolean(payload.clientId),
    hasProjectId: Boolean(payload.projectId),
    hasWorkflowTypeId: Boolean(payload.workflowTypeId),
  };
}

/**
 * Schedules a job for asynchronous processing and returns quickly.
 *
 * Never blocks the caller on job execution, and never throws for job
 * failures — background errors are caught and logged so unhandled promise
 * rejections cannot crash the app.
 */
export async function enqueueJob(
  name: JobName,
  payload: SlackAiRequestJobPayload,
): Promise<void> {
  logger.info(
    {
      jobName: name,
      ...safeJobMetadata(payload),
    },
    "Enqueuing background job",
  );

  scheduleInProcessJob(async () => {
    try {
      await dispatchJob(name, payload);
    } catch (error) {
      logger.error(
        {
          err: error,
          jobName: name,
          organizationId: payload.organizationId,
          slackTeamId: payload.slackTeamId,
          slackChannelId: payload.slackChannelId,
        },
        "Background job failed",
      );
    }
  });
}

async function dispatchJob(
  name: JobName,
  payload: JobPayloadByName[JobName],
): Promise<void> {
  switch (name) {
    case "slack.ai_request":
      await processSlackAiRequestJob(payload);
      return;
    default: {
      const exhaustiveCheck: never = name;
      throw new Error(`Unsupported job name: ${String(exhaustiveCheck)}`);
    }
  }
}

function scheduleInProcessJob(job: () => Promise<void>): void {
  // TODO: Replace this local in-process dispatcher with a durable queue such as
  // Inngest, Trigger.dev, BullMQ, SQS, or a dedicated worker.
  //
  // This is intentionally minimal for local development and MVP wiring.
  // It is not durable: jobs will be lost if the process crashes or restarts.
  //
  // Slack requires a fast HTTP 2xx acknowledgment, typically within 3 seconds,
  // so expensive model calls and persistence work should happen outside the
  // Slack request lifecycle.
  setImmediate(() => {
    void job();
  });
}

async function processSlackAiRequestJob(
  payload: SlackAiRequestJobPayload,
): Promise<void> {
  await handleSlackAiRequestJob(payload);
}
