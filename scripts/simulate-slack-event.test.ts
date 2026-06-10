import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildSlackEventPayload,
  DEFAULT_SIMULATE_SLACK_OPTIONS,
  formatSimulationSummary,
  parseCliArgs,
  signSlackRequest,
  simulateSlackEvent,
} from "./simulate-slack-event.lib";

const SIGNING_SECRET = "dev-slack-signing-secret";
const FIXED_NOW = 1_717_891_200_123;
const FIXED_BODY = JSON.stringify({ hello: "world" });
const FIXED_TIMESTAMP = "1717891200";

describe("signSlackRequest", () => {
  it("returns a string starting with v0=", () => {
    const signature = signSlackRequest({
      rawBody: FIXED_BODY,
      timestamp: FIXED_TIMESTAMP,
      signingSecret: SIGNING_SECRET,
    });

    expect(signature.startsWith("v0=")).toBe(true);
  });

  it("is deterministic for known secret, timestamp, and body", () => {
    const first = signSlackRequest({
      rawBody: FIXED_BODY,
      timestamp: FIXED_TIMESTAMP,
      signingSecret: SIGNING_SECRET,
    });
    const second = signSlackRequest({
      rawBody: FIXED_BODY,
      timestamp: FIXED_TIMESTAMP,
      signingSecret: SIGNING_SECRET,
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^v0=[a-f0-9]{64}$/);
  });
});

describe("buildSlackEventPayload", () => {
  it("includes team, channel, user, and text", () => {
    const payload = buildSlackEventPayload({
      team: "T_DEMO",
      channel: "C_ACME",
      user: "U_DEMO",
      text: "@YourBot draft a client update",
      eventType: "app_mention",
      now: FIXED_NOW,
    });

    expect(payload.team_id).toBe("T_DEMO");
    expect(payload.event.channel).toBe("C_ACME");
    expect(payload.event.user).toBe("U_DEMO");
    expect(payload.event.text).toBe("@YourBot draft a client update");
    expect(payload.event.type).toBe("app_mention");
  });
});

describe("parseCliArgs", () => {
  it("uses the expected defaults", () => {
    expect(parseCliArgs([])).toEqual(DEFAULT_SIMULATE_SLACK_OPTIONS);
  });

  it("overrides defaults from CLI args", () => {
    expect(
      parseCliArgs([
        "--team",
        "T_UNKNOWN",
        "--channel",
        "C_UNMAPPED",
        "--user",
        "U_TEST",
        "--event",
        "message",
        "--url",
        "http://localhost:4000/api/slack/events",
        "--text",
        "hello",
      ]),
    ).toEqual({
      team: "T_UNKNOWN",
      channel: "C_UNMAPPED",
      user: "U_TEST",
      event: "message",
      url: "http://localhost:4000/api/slack/events",
      text: "hello",
    });
  });
});

describe("simulateSlackEvent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends application/json with Slack signature headers", async () => {
    await simulateSlackEvent({
      options: DEFAULT_SIMULATE_SLACK_OPTIONS,
      signingSecret: SIGNING_SECRET,
      now: FIXED_NOW,
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(DEFAULT_SIMULATE_SLACK_OPTIONS.url);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
    });

    const headers = init.headers as Record<string, string>;
    expect(headers["x-slack-signature"]).toMatch(/^v0=[a-f0-9]+$/);
    expect(headers["x-slack-request-timestamp"]).toBe("1717891200");
    expect(typeof init.body).toBe("string");
  });

  it("does not print the signing secret in formatted output", async () => {
    const result = await simulateSlackEvent({
      options: DEFAULT_SIMULATE_SLACK_OPTIONS,
      signingSecret: SIGNING_SECRET,
      now: FIXED_NOW,
      fetchImpl: fetchMock,
    });

    const summary = formatSimulationSummary(result);

    expect(summary).not.toContain(SIGNING_SECRET);
    expect(summary).toContain("textLength:");
    expect(summary).not.toContain("@YourBot draft a client update");
  });
});
