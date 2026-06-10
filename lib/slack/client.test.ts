import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  SLACK_BOT_TOKEN: "xoxb-test-real-token-value",
  SLACK_SIGNING_SECRET: "test-signing-secret",
}));

const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: mockEnv,
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));

import {
  fetchMessageText,
  postEphemeral,
  postMessage,
  SlackClientError,
  updateMessage,
} from "./client";

const fetchMock = vi.fn();

describe("Slack client helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    mockEnv.SLACK_BOT_TOKEN = "xoxb-test-real-token-value";
    vi.clearAllMocks();
  });

  function mockSlackOk(body: Record<string, unknown>, status = 200) {
    fetchMock.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: vi.fn().mockResolvedValue({ ok: true, ...body }),
    });
  }

  it("postMessage calls chat.postMessage with channel, text, blocks, and thread_ts", async () => {
    mockSlackOk({ ts: "123.456", channel: "C_TEST" });

    await postMessage({
      channel: "C_TEST",
      threadTs: "111.000",
      text: "Hello",
      blocks: [{ type: "section" }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://slack.com/api/chat.postMessage",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Bearer ${mockEnv.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json; charset=utf-8",
        }),
        body: JSON.stringify({
          channel: "C_TEST",
          text: "Hello",
          thread_ts: "111.000",
          blocks: [{ type: "section" }],
        }),
      }),
    );
  });

  it("postMessage returns ts", async () => {
    mockSlackOk({ ts: "123.456" });

    await expect(
      postMessage({ channel: "C_TEST", text: "Hello" }),
    ).resolves.toEqual({ ts: "123.456" });
  });

  it("updateMessage calls chat.update with channel, ts, text, and blocks", async () => {
    mockSlackOk({ ts: "123.456" });

    await updateMessage({
      channel: "C_TEST",
      ts: "123.456",
      text: "Updated",
      blocks: [{ type: "section" }],
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      channel: "C_TEST",
      ts: "123.456",
      text: "Updated",
      blocks: [{ type: "section" }],
    });
  });

  it("updateMessage returns ts", async () => {
    mockSlackOk({ ts: "123.456" });

    await expect(
      updateMessage({ channel: "C_TEST", ts: "123.456", text: "Updated" }),
    ).resolves.toEqual({ ts: "123.456" });
  });

  it("postEphemeral calls chat.postEphemeral with channel, user, text, and blocks", async () => {
    mockSlackOk({ message_ts: "999.001" });

    await postEphemeral({
      channel: "C_TEST",
      user: "U_TEST",
      text: "Only you",
      blocks: [{ type: "section" }],
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      channel: "C_TEST",
      user: "U_TEST",
      text: "Only you",
      blocks: [{ type: "section" }],
    });
  });

  it("fetchMessageText uses conversations.history for root messages", async () => {
    mockSlackOk({ messages: [{ ts: "333.444", text: "Root message" }] });

    await expect(
      fetchMessageText({
        channel: "C_TEST",
        messageTs: "333.444",
      }),
    ).resolves.toEqual({ text: "Root message" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://slack.com/api/conversations.history",
    );
  });

  it("fetchMessageText uses conversations.replies for thread replies", async () => {
    mockSlackOk({
      messages: [
        { ts: "111.222", text: "Thread root" },
        { ts: "333.444", text: "Reply message" },
      ],
    });

    await expect(
      fetchMessageText({
        channel: "C_TEST",
        messageTs: "333.444",
        threadTs: "111.222",
      }),
    ).resolves.toEqual({ text: "Reply message" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://slack.com/api/conversations.replies",
    );
  });

  it("throws SlackClientError when Slack returns ok: false", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ ok: false, error: "channel_not_found" }),
    });

    await expect(
      postMessage({ channel: "C_TEST", text: "Hello" }),
    ).rejects.toMatchObject({
      name: "SlackClientError",
      details: { slackError: "channel_not_found" },
    });
  });

  it("throws SlackClientError when bot token is missing", async () => {
    mockEnv.SLACK_BOT_TOKEN = "";

    await expect(
      postMessage({ channel: "C_TEST", text: "Hello" }),
    ).rejects.toMatchObject({
      name: "SlackClientError",
      message: "Slack bot token is not configured",
    });
  });

  it("throws SlackClientError when bot token is a placeholder", async () => {
    mockEnv.SLACK_BOT_TOKEN = "xoxb-dev-placeholder-token";

    await expect(
      postMessage({ channel: "C_TEST", text: "Hello" }),
    ).rejects.toMatchObject({
      name: "SlackClientError",
      message: "Slack bot token is a dev placeholder",
    });
  });

  it("does not log bearer token or message text", async () => {
    mockSlackOk({ ts: "123.456" });

    await postMessage({ channel: "C_TEST", text: "Secret Slack text" });

    const loggedPayload = JSON.stringify(mockLogger.debug.mock.calls);
    expect(loggedPayload).not.toContain(mockEnv.SLACK_BOT_TOKEN);
    expect(loggedPayload).not.toContain("Secret Slack text");
  });
});

describe("SlackClientError", () => {
  it("includes structured details", () => {
    const error = new SlackClientError("failed", {
      method: "chat.postMessage",
      slackError: "invalid_auth",
      status: 200,
    });

    expect(error.name).toBe("SlackClientError");
    expect(error.details?.method).toBe("chat.postMessage");
  });
});
