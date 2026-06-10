import crypto from "node:crypto";

const SLACK_SIGNATURE_VERSION = "v0";
const MAX_TIMESTAMP_AGE_SECONDS = 60 * 5;

export interface VerifySlackRequestInput {
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
}

/**
 * Verifies a Slack request signature per
 * https://api.slack.com/authentication/verifying-requests-from-slack
 *
 * Must be called with the exact raw body string, before any parsing.
 *
 * Reads SLACK_SIGNING_SECRET from process.env directly (rather than lib/env)
 * so a missing secret results in a clean rejection instead of a module-load
 * crash, and so the behavior is unit-testable.
 */
export function verifySlackRequest({
  signature,
  timestamp,
  rawBody,
}: VerifySlackRequestInput): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!signature || !timestamp || !signingSecret) {
    return false;
  }

  const timestampSeconds = Number(timestamp);

  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (Math.abs(nowSeconds - timestampSeconds) > MAX_TIMESTAMP_AGE_SECONDS) {
    return false;
  }

  const baseString = `${SLACK_SIGNATURE_VERSION}:${timestamp}:${rawBody}`;
  const expectedSignature = `${SLACK_SIGNATURE_VERSION}=${crypto
    .createHmac("sha256", signingSecret)
    .update(baseString, "utf8")
    .digest("hex")}`;

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
