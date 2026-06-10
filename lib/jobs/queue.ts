import { logger } from "@/lib/logger";

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
};

type JobPayloadByName = {
  "slack.ai_request": SlackAiRequestJobPayload;
};

/**
 * Schedules a job for asynchronous processing and returns quickly.
 *
 * Never blocks the caller on job execution, and never throws for job
 * failures — background errors are caught and logged so unhandled promise
 * rejections cannot crash the app.
 */
export async function enqueueJob<Name extends JobName>(
  name: Name,
  payload: JobPayloadByName[Name],
): Promise<void> {
  scheduleInProcessJob(async () => {
    try {
      await runJob(name, payload);
    } catch (error) {
      logger.error({ err: error, jobName: name }, "Background job failed");
    }
  });
}

async function runJob(
  name: JobName,
  payload: JobPayloadByName[JobName],
): Promise<void> {
  switch (name) {
    case "slack.ai_request":
      await processSlackAiRequestJob(payload);
      return;
    default: {
      // Exhaustive check: adding a JobName without a case above is a
      // compile-time error.
      const exhaustiveCheck: never = name;
      throw new Error(`Unsupported job name: ${String(exhaustiveCheck)}`);
    }
  }
}

function scheduleInProcessJob(job: () => Promise<void>): void {
  // TODO: Replace this local in-process dispatcher with a durable queue
  // such as Inngest, Trigger.dev, BullMQ, SQS, or a dedicated worker.
  //
  // setImmediate defers execution until after the current request's I/O
  // cycle, so the Slack route can flush its 200 response without waiting
  // on job work. Intentionally minimal and not production-grade.
  setImmediate(() => {
    void job();
  });
}

async function processSlackAiRequestJob(
  payload: SlackAiRequestJobPayload,
): Promise<void> {
  logger.info(
    {
      jobName: "slack.ai_request",
      organizationId: payload.organizationId,
      slackTeamId: payload.slackTeamId,
      slackChannelId: payload.slackChannelId,
      slackUserId: payload.slackUserId,
      hasThreadTs: Boolean(payload.threadTs),
      hasMessageTs: Boolean(payload.messageTs),
      textLength: payload.text.length,
    },
    "Slack AI request job stub received",
  );

  // TODO: Implement Slack AI request processing:
  // 1. Persist the request/event metadata.
  // 2. Call LiteLLM outside the Slack request lifecycle.
  // 3. Store usage/cost data.
  // 4. Post or update the Slack message with the final result.
}
