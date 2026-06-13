import { NextResponse } from "next/server";

import { enqueueJob } from "@/lib/jobs/queue";
import { logger } from "@/lib/logger";
import {
  buildInteractivityIdempotencyKey,
  buildSlackInteractivityJobPayload,
  isSupportedInteractiveAction,
  parseSlackInteractivePayload,
} from "@/lib/slack/interactivity";
import { verifySlackRequest } from "@/lib/slack/verifySlackRequest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Slack interactive action endpoint (Block Kit button clicks).
 *
 * Slack requires a fast HTTP 2xx acknowledgment, typically within 3 seconds.
 * This route verifies the signature, enqueues a durable background job, and
 * returns immediately. No LiteLLM or provider calls happen in this request
 * lifecycle.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  const verified = verifySlackRequest({
    signature: request.headers.get("x-slack-signature"),
    timestamp: request.headers.get("x-slack-request-timestamp"),
    rawBody,
  });

  if (!verified) {
    logger.warn(
      { route: "/api/slack/interactivity", verified: false },
      "Rejected invalid Slack interactivity request",
    );
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const parsed = parseSlackInteractivePayload(rawBody);

  if (!parsed.ok) {
    logger.warn(
      { route: "/api/slack/interactivity", reason: parsed.reason },
      "Invalid Slack interactivity payload",
    );
    return NextResponse.json({ ok: false, reason: parsed.reason }, { status: 400 });
  }

  const payload = parsed.payload;
  const action = payload.actions?.[0];

  if (!action || !isSupportedInteractiveAction(action.action_id)) {
    logger.info(
      {
        route: "/api/slack/interactivity",
        actionId: action?.action_id,
      },
      "Ignoring unsupported Slack interactive action",
    );
    return NextResponse.json({ ok: true });
  }

  const jobPayload = buildSlackInteractivityJobPayload(payload);

  if (!jobPayload) {
    logger.warn(
      {
        route: "/api/slack/interactivity",
        actionId: action.action_id,
      },
      "Could not build Slack interactivity job payload",
    );
    return NextResponse.json({ ok: true });
  }

  await enqueueJob("slack.interactivity", jobPayload, {
    idempotencyKey: buildInteractivityIdempotencyKey(jobPayload),
  });

  return NextResponse.json({ ok: true });
}
