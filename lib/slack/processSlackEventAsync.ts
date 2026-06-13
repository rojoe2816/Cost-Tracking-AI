import { enqueueJob } from "@/lib/jobs/queue";
import { logger } from "@/lib/logger";
import type { SlackEventCallbackPayload } from "@/lib/slack/types";

const SUPPORTED_EVENT_TYPES = new Set(["message", "app_mention"]);

/**
 * Async processing for verified Slack Events API callbacks.
 *
 * Slack requires an HTTP 2xx response within 3 seconds, so the events route
 * acknowledges immediately and hands the payload here. This function
 * normalizes supported user messages and enqueues durable background AI work.
 *
 * Prompt text is not stored in the job queue. The worker resolves message text
 * transiently from Slack using message timestamps when processing jobs.
 */
export async function processSlackEventAsync(
  payload: SlackEventCallbackPayload,
): Promise<void> {
  const event = payload.event;
  const slackTeamId = extractSlackTeamId(payload);
  const text = (event?.text ?? "").trim();

  const metadata = {
    eventType: event?.type,
    eventSubtype: event?.subtype,
    slackTeamId,
    slackChannelId: event?.channel,
    slackUserId: event?.user,
    hasThreadTs: Boolean(event?.thread_ts),
    hasMessageTs: Boolean(event?.ts),
    textLength: text.length,
  };

  if (!shouldEnqueueSlackAiRequest(payload)) {
    logger.info(
      { ...metadata, enqueued: false },
      "Ignored unsupported Slack event for AI processing",
    );
    return;
  }

  await enqueueJob(
    "slack.ai_request",
    {
      slackTeamId: slackTeamId!,
      slackChannelId: event!.channel!,
      slackUserId: event!.user!,
      ...(event!.thread_ts ? { threadTs: event!.thread_ts } : {}),
      ...(event!.ts ? { messageTs: event!.ts } : {}),
    },
    {
      idempotencyKey: `slack:event:${slackTeamId}:${event!.channel}:${event!.ts}`,
    },
  );

  logger.info(
    { ...metadata, enqueued: true },
    "Enqueued Slack AI request job from event",
  );
}

function extractSlackTeamId(
  payload: SlackEventCallbackPayload,
): string | undefined {
  return payload.team_id ?? payload.authorizations?.[0]?.team_id;
}

function shouldEnqueueSlackAiRequest(
  payload: SlackEventCallbackPayload,
): boolean {
  const event = payload.event;

  if (!event) {
    return false;
  }

  const slackTeamId = extractSlackTeamId(payload);

  if (!slackTeamId || !event.channel || !event.user) {
    return false;
  }

  if (event.bot_id || event.subtype === "bot_message") {
    return false;
  }

  if (!event.type || !SUPPORTED_EVENT_TYPES.has(event.type)) {
    return false;
  }

  if (event.type === "message" && event.subtype) {
    return false;
  }

  const text = (event.text ?? "").trim();

  if (!text) {
    return false;
  }

  return true;
}
