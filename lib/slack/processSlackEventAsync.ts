import { logger } from "@/lib/logger";
import type { SlackEventCallbackPayload } from "@/lib/slack/types";

/**
 * Async processing stub for verified Slack events.
 *
 * Slack requires an HTTP 2xx response within 3 seconds, so the events route
 * acknowledges immediately and hands the payload to this function. Expensive
 * work (database writes, LiteLLM calls) must happen here, never in the
 * request/acknowledgment path.
 */
export async function processSlackEventAsync(
  payload: SlackEventCallbackPayload,
): Promise<void> {
  logger.debug(
    {
      eventType: payload.event?.type,
      teamId: payload.team_id,
      channelId: payload.event?.channel,
    },
    "processSlackEventAsync stub invoked",
  );

  // TODO:
  // Later this will:
  // 1. normalize the Slack event
  // 2. store the prompt/message in the database
  // 3. send work to LiteLLM
  // 4. record token usage and estimated cost
  // 5. post/update the Slack response
}
