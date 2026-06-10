// Sends signed mock Slack requests to the local events endpoint.
//
// Usage:
//   npm run dev          (in another terminal)
//   node scripts/test-slack-signature.mjs
//
// Reads SLACK_SIGNING_SECRET (and optionally APP_BASE_URL) from .env.

import "dotenv/config";
import crypto from "node:crypto";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
const signingSecret = process.env.SLACK_SIGNING_SECRET;

if (!signingSecret) {
  console.error("SLACK_SIGNING_SECRET is not set. Copy .env.example to .env first.");
  process.exit(1);
}

function sign(rawBody, timestamp) {
  return `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(`v0:${timestamp}:${rawBody}`, "utf8")
    .digest("hex")}`;
}

async function send(name, rawBody, { signature, timestamp }) {
  const response = await fetch(`${baseUrl}/api/slack/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-slack-signature": signature,
      "x-slack-request-timestamp": timestamp,
    },
    body: rawBody,
  });
  const body = await response.text();

  console.log(`\n${name}`);
  console.log(`  status: ${response.status}`);
  console.log(`  body:   ${body}`);

  return response.status;
}

const timestamp = Math.floor(Date.now() / 1000).toString();

const eventBody = JSON.stringify({
  type: "event_callback",
  team_id: "T_DEV_TEST",
  event: {
    type: "app_mention",
    channel: "C_DEV_TEST",
    user: "U_DEV_TEST",
    ts: `${timestamp}.000100`,
    text: "Hello from the signed mock request script",
  },
});

const challengeBody = JSON.stringify({
  type: "url_verification",
  challenge: "local-challenge-token",
});

const results = [];

results.push({
  name: "valid signed event_callback",
  expected: 200,
  actual: await send("Valid signed event_callback request", eventBody, {
    signature: sign(eventBody, timestamp),
    timestamp,
  }),
});

results.push({
  name: "valid signed url_verification",
  expected: 200,
  actual: await send("Valid signed url_verification request", challengeBody, {
    signature: sign(challengeBody, timestamp),
    timestamp,
  }),
});

const tamperedBody = eventBody.replace("Hello", "Tampered");

results.push({
  name: "tampered body with original signature",
  expected: 401,
  actual: await send("Tampered request (body changed after signing)", tamperedBody, {
    signature: sign(eventBody, timestamp),
    timestamp,
  }),
});

results.push({
  name: "invalid signature",
  expected: 401,
  actual: await send("Invalid signature request", eventBody, {
    signature: "v0=deadbeef",
    timestamp,
  }),
});

console.log("\n--- Summary ---");
let failed = false;

for (const { name, expected, actual } of results) {
  const pass = expected === actual;
  failed ||= !pass;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name} (expected ${expected}, got ${actual})`);
}

process.exit(failed ? 1 : 0);
