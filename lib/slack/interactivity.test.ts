import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAudit = vi.hoisted(() => vi.fn());
const mockEnqueueJob = vi.hoisted(() => vi.fn());
const mockCreateMapping = vi.hoisted(() => vi.fn());
const mockMarkAiRequestCanceled = vi.hoisted(() => vi.fn());
const mockFetchMessageText = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ text: "Recovered original prompt" }),
);
const mockPostMessage = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ ts: "999.0001" }),
);
const mockUpdateMessage = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ ts: "888.0001" }),
);
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/ai/requests", () => ({
  getAiRequestAuditById: mockGetAudit,
  markAiRequestCanceled: mockMarkAiRequestCanceled,
}));

vi.mock("@/lib/jobs", () => ({
  enqueueJob: mockEnqueueJob,
}));

vi.mock("@/lib/slack/attribution", () => ({
  createOrUpdateSlackChannelMapping: mockCreateMapping,
}));

vi.mock("@/lib/slack/client", () => ({
  fetchMessageText: mockFetchMessageText,
  postMessage: mockPostMessage,
  updateMessage: mockUpdateMessage,
  SlackClientError: class SlackClientError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "SlackClientError";
    }
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));

import {
  extractSelectedClientId,
  handleSlackInteractiveAction,
  parseActionValue,
  parseSlackInteractivePayload,
} from "./interactivity";

const AUDIT_ID = "audit_123";
const TEAM_ID = "T_TEST";
const CHANNEL_ID = "C_TEST";
const USER_ID = "U_TEST";
const ASSIGNMENT_MESSAGE_TS = "777.0001";
const RECOVERED_TEXT = "Recovered original prompt";

const auditRecord = {
  id: AUDIT_ID,
  organizationId: "org_1",
  slackTeamId: TEAM_ID,
  slackChannelId: CHANNEL_ID,
  slackUserId: USER_ID,
  slackThreadTs: "111.222",
  slackMessageTs: "333.444",
  clientId: null,
  projectId: null,
  workflowTypeId: null,
  userId: null,
};

function buildPayload(actionId: string, mode: string, extra: Record<string, unknown> = {}) {
  return {
    type: "block_actions",
    team: { id: TEAM_ID },
    user: { id: USER_ID },
    channel: { id: CHANNEL_ID, name: "general" },
    message: { ts: ASSIGNMENT_MESSAGE_TS },
    actions: [
      {
        action_id: actionId,
        value: JSON.stringify({ originalRequestId: AUDIT_ID, mode }),
      },
    ],
    ...extra,
  };
}

describe("parseSlackInteractivePayload", () => {
  it("parses urlencoded payload field", () => {
    const payload = { type: "block_actions", team: { id: TEAM_ID } };
    const rawBody = new URLSearchParams({
      payload: JSON.stringify(payload),
    }).toString();

    expect(parseSlackInteractivePayload(rawBody)).toEqual({
      ok: true,
      payload,
    });
  });

  it("returns an error when payload is missing", () => {
    expect(parseSlackInteractivePayload("foo=bar").ok).toBe(false);
  });
});

describe("parseActionValue", () => {
  it("parses originalRequestId and mode", () => {
    expect(
      parseActionValue(
        JSON.stringify({ originalRequestId: AUDIT_ID, mode: "CANCEL" }),
      ),
    ).toEqual({
      ok: true,
      value: { originalRequestId: AUDIT_ID, mode: "CANCEL" },
    });
  });
});

describe("extractSelectedClientId", () => {
  it("reads selected client from state.values", () => {
    const clientId = extractSelectedClientId({
      state: {
        values: {
          client_assignment: {
            select_client: {
              selected_option: { value: "client_1" },
            },
          },
        },
      },
    });

    expect(clientId).toBe("client_1");
  });
});

describe("handleSlackInteractiveAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAudit.mockResolvedValue(auditRecord);
    mockEnqueueJob.mockResolvedValue(undefined);
    mockMarkAiRequestCanceled.mockResolvedValue(undefined);
    mockFetchMessageText.mockResolvedValue({ text: RECOVERED_TEXT });
    mockCreateMapping.mockResolvedValue({
      organizationId: "org_1",
      clientId: "client_1",
      projectId: null,
      workflowTypeId: null,
      mappingStatus: "MAPPED",
    });
  });

  it("cancel_assignment does not fetch original message or enqueue", async () => {
    await handleSlackInteractiveAction(
      buildPayload("cancel_assignment", "CANCEL"),
    );

    expect(mockFetchMessageText).not.toHaveBeenCalled();
    expect(mockEnqueueJob).not.toHaveBeenCalled();
    expect(mockCreateMapping).not.toHaveBeenCalled();
    expect(mockMarkAiRequestCanceled).toHaveBeenCalledWith(AUDIT_ID);
    expect(mockUpdateMessage).toHaveBeenCalledWith({
      channel: CHANNEL_ID,
      ts: ASSIGNMENT_MESSAGE_TS,
      text: "Canceled. No AI usage was recorded.",
    });
  });

  it("assign_once recovers Slack text, enqueues, and updates assignment message", async () => {
    await handleSlackInteractiveAction(
      buildPayload("assign_once", "ASSIGN_ONCE", {
        state: {
          values: {
            client_assignment: {
              select_client: {
                selected_option: { value: "client_1" },
              },
            },
          },
        },
      }),
    );

    expect(mockFetchMessageText).toHaveBeenCalledWith({
      channel: CHANNEL_ID,
      messageTs: "333.444",
      threadTs: "111.222",
    });
    expect(mockCreateMapping).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "ASSIGN_ONCE" }),
    );
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "slack.ai_request",
      expect.objectContaining({
        text: RECOVERED_TEXT,
        aiRequestAuditId: AUDIT_ID,
      }),
    );
    expect(mockUpdateMessage).toHaveBeenCalledWith({
      channel: CHANNEL_ID,
      ts: ASSIGNMENT_MESSAGE_TS,
      text: "Assigned this request once. Processing...",
    });
  });

  it("map_channel persists mapping and updates assignment message", async () => {
    await handleSlackInteractiveAction(
      buildPayload("map_channel", "MAP_CHANNEL", {
        state: {
          values: {
            client_assignment: {
              select_client: {
                selected_option: { value: "client_1" },
              },
            },
          },
        },
      }),
    );

    expect(mockCreateMapping).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "MAP_CHANNEL" }),
    );
    expect(mockUpdateMessage).toHaveBeenCalledWith({
      channel: CHANNEL_ID,
      ts: ASSIGNMENT_MESSAGE_TS,
      text: "Channel mapped. Processing...",
    });
  });

  it("assign_internal enqueues null attribution and updates assignment message", async () => {
    await handleSlackInteractiveAction(
      buildPayload("assign_internal", "ASSIGN_INTERNAL"),
    );

    expect(mockCreateMapping).not.toHaveBeenCalled();
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "slack.ai_request",
      expect.objectContaining({
        clientId: null,
        projectId: null,
        workflowTypeId: null,
        mappingStatus: "MAPPED",
        text: RECOVERED_TEXT,
      }),
    );
    expect(mockUpdateMessage).toHaveBeenCalledWith({
      channel: CHANNEL_ID,
      ts: ASSIGNMENT_MESSAGE_TS,
      text: "Assigned as internal/no client. Processing...",
    });
  });

  it("does not enqueue when original audit is missing", async () => {
    mockGetAudit.mockResolvedValue(null);

    await handleSlackInteractiveAction(
      buildPayload("assign_internal", "ASSIGN_INTERNAL"),
    );

    expect(mockFetchMessageText).not.toHaveBeenCalled();
    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("does not enqueue when Slack message recovery fails", async () => {
    mockFetchMessageText.mockResolvedValue({ text: null });

    await handleSlackInteractiveAction(
      buildPayload("assign_internal", "ASSIGN_INTERNAL"),
    );

    expect(mockEnqueueJob).not.toHaveBeenCalled();
    expect(mockUpdateMessage).not.toHaveBeenCalled();
    expect(mockPostMessage).toHaveBeenCalled();
  });

  it("logs safely when assignment message update fails", async () => {
    mockUpdateMessage.mockRejectedValue(new Error("Slack update failed"));

    await handleSlackInteractiveAction(
      buildPayload("assign_internal", "ASSIGN_INTERNAL"),
    );

    expect(mockEnqueueJob).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
    const loggedPayload = JSON.stringify(mockLogger.error.mock.calls);
    expect(loggedPayload).not.toContain(RECOVERED_TEXT);
  });

  it("does not log recovered Slack message text", async () => {
    await handleSlackInteractiveAction(
      buildPayload("assign_internal", "ASSIGN_INTERNAL"),
    );

    const loggedPayload = JSON.stringify([
      ...mockLogger.info.mock.calls,
      ...mockLogger.warn.mock.calls,
      ...mockLogger.error.mock.calls,
    ]);
    expect(loggedPayload).not.toContain(RECOVERED_TEXT);
  });
});
