import { logger } from "@/lib/logger";
import { processSlackEventAsync } from "@/lib/slack/processSlackEventAsync";
import type { SlackEventPayload } from "@/lib/slack/types";
import { verifySlackRequest } from "@/lib/slack/verifySlackRequest";

export const dynamic = "force-dynamic";

/**
 * Slack Events API ingestion endpoint.
 *
 * Slack requires an HTTP 2xx response within 3 seconds.
 * This route must acknowledge quickly and push expensive AI work to
 * async/background processing. No LiteLLM or model calls happen in this
 * request lifecycle.
 */
export async function POST(request: Request) {
  // The raw body must be read before any parsing so the signature is
  // computed over the exact bytes Slack signed.
  const rawBody = await request.text();

  const verified = verifySlackRequest({
    signature: request.headers.get("x-slack-signature"),
    timestamp: request.headers.get("x-slack-request-timestamp"),
    rawBody,
  });

  if (!verified) {
    logger.warn(
      { route: "/api/slack/events", verified: false },
      "Rejected Slack request with invalid signature",
    );
    return new Response("Unauthorized", { status: 401 });
  }

  // Parsing happens only after signature verification.
  let payload: SlackEventPayload | null = null;

  try {
    payload = JSON.parse(rawBody) as SlackEventPayload;
  } catch {
    payload = null;
  }

  const payloadType = payload?.type;

  if (payload?.type === "url_verification" && payload.challenge) {
    logger.info(
      { payloadType: payload.type, ignored: false, asyncTriggered: false },
      "Answered Slack URL verification challenge",
    );
    return Response.json({ challenge: payload.challenge });
  }

  if (payload?.type === "event_callback") {
    const event = payload.event;
    const metadata = {
      payloadType: payload.type,
      eventType: event?.type,
      teamId: payload.team_id,
      channelId: event?.channel,
      userId: event?.user,
      eventTs: event?.ts,
    };

    // Ignore messages from bots (including this app) to prevent infinite
    // loops where the app responds to its own messages.
    const isBotMessage =
      Boolean(event?.bot_id) || event?.subtype === "bot_message";

    if (isBotMessage) {
      logger.info(
        { ...metadata, ignored: true, asyncTriggered: false },
        "Ignored Slack bot message",
      );
      return Response.json({ ok: true, ignored: true });
    }

    logger.info(
      { ...metadata, ignored: false, asyncTriggered: true },
      "Acknowledged Slack event and scheduled async processing",
    );

    // Fire-and-forget: Slack gets its 200 immediately while the (future)
    // expensive work runs outside the acknowledgment path.
    void processSlackEventAsync(payload).catch((error: unknown) => {
      logger.error(
        {
          ...metadata,
          error: error instanceof Error ? error.message : String(error),
        },
        "Async Slack event processing failed",
      );
    });

    return Response.json({ ok: true });
  }

  logger.info(
    { payloadType: payloadType ?? "unparseable", ignored: true, asyncTriggered: false },
    "Ignored unsupported Slack payload",
  );
  return Response.json({ ok: true, ignored: true });
}
