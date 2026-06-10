import crypto from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { processSlackEventAsync } from "@/lib/slack/processSlackEventAsync";

import { POST } from "./route";

vi.mock("@/lib/slack/processSlackEventAsync", () => ({
  processSlackEventAsync: vi.fn().mockResolvedValue(undefined),
}));

const SIGNING_SECRET = "test-signing-secret";

function signSlackRequest(rawBody: string, timestamp: string, secret = SIGNING_SECRET) {
  return `v0=${crypto
    .createHmac("sha256", secret)
    .update(`v0:${timestamp}:${rawBody}`, "utf8")
    .digest("hex")}`;
}

function createSlackRequest(
  rawBody: string,
  options: { signature?: string | null; timestamp?: string | null } = {},
) {
  const timestamp =
    options.timestamp === undefined
      ? Math.floor(Date.now() / 1000).toString()
      : options.timestamp;
  const signature =
    options.signature === undefined && timestamp !== null
      ? signSlackRequest(rawBody, timestamp)
      : options.signature;

  const headers = new Headers({ "Content-Type": "application/json" });

  if (signature) {
    headers.set("x-slack-signature", signature);
  }

  if (timestamp) {
    headers.set("x-slack-request-timestamp", timestamp);
  }

  return new Request("http://localhost:3000/api/slack/events", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

const eventCallbackBody = JSON.stringify({
  type: "event_callback",
  team_id: "T_TEST",
  event: {
    type: "app_mention",
    channel: "C_TEST",
    user: "U_TEST",
    ts: "1717891200.000100",
    text: "hello",
  },
});

describe("POST /api/slack/events", () => {
  const originalSecret = process.env.SLACK_SIGNING_SECRET;

  beforeEach(() => {
    process.env.SLACK_SIGNING_SECRET = SIGNING_SECRET;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.SLACK_SIGNING_SECRET;
    } else {
      process.env.SLACK_SIGNING_SECRET = originalSecret;
    }
    vi.restoreAllMocks();
  });

  it("answers a valid url_verification challenge", async () => {
    const rawBody = JSON.stringify({
      type: "url_verification",
      challenge: "challenge-token-123",
    });

    const response = await POST(createSlackRequest(rawBody));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ challenge: "challenge-token-123" });
    expect(processSlackEventAsync).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature with 401 and does not process the payload", async () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const response = await POST(
      createSlackRequest(eventCallbackBody, {
        signature: signSlackRequest(eventCallbackBody, timestamp, "wrong-secret"),
        timestamp,
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
    expect(processSlackEventAsync).not.toHaveBeenCalled();
  });

  it("acknowledges a valid event_callback and triggers async processing without LiteLLM calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const response = await POST(createSlackRequest(eventCallbackBody));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(processSlackEventAsync).toHaveBeenCalledTimes(1);
    expect(processSlackEventAsync).toHaveBeenCalledWith(
      expect.objectContaining({ type: "event_callback", team_id: "T_TEST" }),
    );
    // No model/LiteLLM call happens in the request lifecycle.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignores bot messages without triggering async processing", async () => {
    const botBodies = [
      JSON.stringify({
        type: "event_callback",
        team_id: "T_TEST",
        event: { type: "message", bot_id: "B_TEST", channel: "C_TEST" },
      }),
      JSON.stringify({
        type: "event_callback",
        team_id: "T_TEST",
        event: { type: "message", subtype: "bot_message", channel: "C_TEST" },
      }),
    ];

    for (const rawBody of botBodies) {
      const response = await POST(createSlackRequest(rawBody));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, ignored: true });
    }

    expect(processSlackEventAsync).not.toHaveBeenCalled();
  });

  it("rejects a request with missing Slack headers with 401", async () => {
    const response = await POST(
      createSlackRequest(eventCallbackBody, { signature: null, timestamp: null }),
    );

    expect(response.status).toBe(401);
    expect(processSlackEventAsync).not.toHaveBeenCalled();
  });

  it("rejects a correctly signed request with an old timestamp with 401", async () => {
    const staleTimestamp = (Math.floor(Date.now() / 1000) - 60 * 5 - 1).toString();
    const response = await POST(
      createSlackRequest(eventCallbackBody, {
        signature: signSlackRequest(eventCallbackBody, staleTimestamp),
        timestamp: staleTimestamp,
      }),
    );

    expect(response.status).toBe(401);
    expect(processSlackEventAsync).not.toHaveBeenCalled();
  });

  it("rejects a tampered body signed for different content with 401", async () => {
    const tamperedBody = eventCallbackBody.replace("hello", "attack");
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const response = await POST(
      createSlackRequest(tamperedBody, {
        signature: signSlackRequest(eventCallbackBody, timestamp),
        timestamp,
      }),
    );

    expect(response.status).toBe(401);
    expect(processSlackEventAsync).not.toHaveBeenCalled();
  });

  it("verifies the signature before parsing the body", async () => {
    // Unparseable body + bad signature: 401, proving no JSON parsing ran
    // before verification failed.
    const malformedBody = "{not-valid-json";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const unverifiedResponse = await POST(
      createSlackRequest(malformedBody, {
        signature: signSlackRequest(malformedBody, timestamp, "wrong-secret"),
        timestamp,
      }),
    );

    expect(unverifiedResponse.status).toBe(401);

    // Same unparseable body with a valid signature passes verification,
    // proving the signature is computed over the exact raw body.
    const verifiedResponse = await POST(createSlackRequest(malformedBody));

    expect(verifiedResponse.status).toBe(200);
    expect(await verifiedResponse.json()).toEqual({ ok: true, ignored: true });
    expect(processSlackEventAsync).not.toHaveBeenCalled();
  });
});
