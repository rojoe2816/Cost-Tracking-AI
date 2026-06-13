import crypto from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnqueueJob = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/jobs/queue", () => ({
  enqueueJob: mockEnqueueJob,
}));

import { POST } from "./route";

const SIGNING_SECRET = "test-signing-secret";

function signSlackRequest(rawBody: string, timestamp: string, secret = SIGNING_SECRET) {
  return `v0=${crypto
    .createHmac("sha256", secret)
    .update(`v0:${timestamp}:${rawBody}`, "utf8")
    .digest("hex")}`;
}

function buildFormBody(payload: Record<string, unknown>) {
  return new URLSearchParams({
    payload: JSON.stringify(payload),
  }).toString();
}

function createRequest(
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

  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded",
  });

  if (signature) {
    headers.set("x-slack-signature", signature);
  }

  if (timestamp) {
    headers.set("x-slack-request-timestamp", timestamp);
  }

  return new Request("http://localhost:3000/api/slack/interactivity", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

describe("POST /api/slack/interactivity", () => {
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
  });

  it("returns 401 for invalid Slack signature", async () => {
    const rawBody = buildFormBody({ type: "block_actions" });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const response = await POST(
      createRequest(rawBody, {
        signature: signSlackRequest(rawBody, timestamp, "wrong-secret"),
        timestamp,
      }),
    );

    expect(response.status).toBe(401);
    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("returns 400 when payload field is missing", async () => {
    const rawBody = "foo=bar";
    const response = await POST(createRequest(rawBody));

    expect(response.status).toBe(400);
    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("returns 200 for unsupported actions without enqueuing a job", async () => {
    const rawBody = buildFormBody({
      type: "block_actions",
      actions: [{ action_id: "unsupported_action" }],
    });
    const response = await POST(createRequest(rawBody));

    expect(response.status).toBe(200);
    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("returns 200 quickly and enqueues a durable interactivity job", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const rawBody = buildFormBody({
      type: "block_actions",
      team: { id: "T_TEST" },
      user: { id: "U_TEST" },
      channel: { id: "C_TEST" },
      message: { ts: "1717891200.000100" },
      actions: [
        {
          action_id: "assignment_cancel",
          value: JSON.stringify({
            originalRequestId: "audit_123",
            mode: "CANCEL",
          }),
        },
      ],
    });

    const response = await POST(createRequest(rawBody));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "slack.interactivity",
      expect.objectContaining({
        actionId: "assignment_cancel",
        slackTeamId: "T_TEST",
        slackChannelId: "C_TEST",
        slackUserId: "U_TEST",
        messageTs: "1717891200.000100",
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringContaining("slack:interactivity:T_TEST:C_TEST"),
      }),
    );
  });

  it("verifies signature before parsing payload", async () => {
    const malformedBody = "payload=not-json";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const unverifiedResponse = await POST(
      createRequest(malformedBody, {
        signature: signSlackRequest(malformedBody, timestamp, "wrong-secret"),
        timestamp,
      }),
    );

    expect(unverifiedResponse.status).toBe(401);

    const verifiedResponse = await POST(createRequest(malformedBody));
    expect(verifiedResponse.status).toBe(400);
  });
});
