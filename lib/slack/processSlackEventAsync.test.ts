import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnqueueJob = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/jobs/queue", () => ({
  enqueueJob: mockEnqueueJob,
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));

import { processSlackEventAsync } from "./processSlackEventAsync";

function buildEventCallback(
  event: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  return {
    type: "event_callback" as const,
    team_id: "T_TEST",
    event,
    ...extra,
  };
}

describe("processSlackEventAsync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues slack.ai_request for a normal user message event", async () => {
    await processSlackEventAsync(
      buildEventCallback({
        type: "message",
        channel: "C_TEST",
        user: "U_TEST",
        ts: "1717891200.000100",
        thread_ts: "1717891199.000050",
        text: "  What is our spend this month?  ",
      }),
    );

    expect(mockEnqueueJob).toHaveBeenCalledTimes(1);
    expect(mockEnqueueJob).toHaveBeenCalledWith("slack.ai_request", {
      slackTeamId: "T_TEST",
      slackChannelId: "C_TEST",
      slackUserId: "U_TEST",
      text: "What is our spend this month?",
      threadTs: "1717891199.000050",
      messageTs: "1717891200.000100",
    });
  });

  it("enqueues app_mention events", async () => {
    await processSlackEventAsync(
      buildEventCallback({
        type: "app_mention",
        channel: "C_TEST",
        user: "U_TEST",
        ts: "1717891200.000200",
        text: "hello bot",
      }),
    );

    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "slack.ai_request",
      expect.objectContaining({
        slackTeamId: "T_TEST",
        text: "hello bot",
      }),
    );
  });

  it("uses authorizations team_id when team_id is absent", async () => {
    await processSlackEventAsync(
      buildEventCallback(
        {
          type: "message",
          channel: "C_TEST",
          user: "U_TEST",
          ts: "1717891200.000300",
          text: "fallback team id",
        },
        { team_id: undefined, authorizations: [{ team_id: "T_AUTH" }] },
      ),
    );

    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "slack.ai_request",
      expect.objectContaining({ slackTeamId: "T_AUTH" }),
    );
  });

  it("does not enqueue bot messages", async () => {
    await processSlackEventAsync(
      buildEventCallback({
        type: "message",
        bot_id: "B_TEST",
        channel: "C_TEST",
        user: "U_TEST",
        text: "bot said this",
      }),
    );

    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("does not enqueue unsupported message subtypes", async () => {
    await processSlackEventAsync(
      buildEventCallback({
        type: "message",
        subtype: "message_changed",
        channel: "C_TEST",
        user: "U_TEST",
        text: "edited",
      }),
    );

    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("does not enqueue when channel, user, or text is missing", async () => {
    const cases = [
      buildEventCallback({
        type: "message",
        user: "U_TEST",
        text: "no channel",
      }),
      buildEventCallback({
        type: "message",
        channel: "C_TEST",
        text: "no user",
      }),
      buildEventCallback({
        type: "message",
        channel: "C_TEST",
        user: "U_TEST",
        text: "   ",
      }),
    ];

    for (const payload of cases) {
      await processSlackEventAsync(payload);
    }

    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("does not enqueue unsupported event types", async () => {
    await processSlackEventAsync(
      buildEventCallback({
        type: "reaction_added",
        channel: "C_TEST",
        user: "U_TEST",
        text: "ignored",
      }),
    );

    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("enqueues without organizationId for unknown workspaces", async () => {
    await processSlackEventAsync(
      buildEventCallback({
        type: "message",
        channel: "C_UNKNOWN",
        user: "U_TEST",
        ts: "1717891200.000400",
        text: "workspace may be unknown",
      }),
    );

    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "slack.ai_request",
      expect.not.objectContaining({ organizationId: expect.anything() }),
    );
  });

  it("does not log raw Slack message text", async () => {
    await processSlackEventAsync(
      buildEventCallback({
        type: "message",
        channel: "C_TEST",
        user: "U_TEST",
        ts: "1717891200.000500",
        text: "Secret prompt text must not appear in logs",
      }),
    );

    const loggedPayload = JSON.stringify(mockLogger.info.mock.calls);
    expect(loggedPayload).not.toContain("Secret prompt text must not appear in logs");
    expect(loggedPayload).toContain('"textLength":');
  });
});
