import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAudit = vi.hoisted(() => vi.fn());
const mockEnqueueJob = vi.hoisted(() => vi.fn());
const mockCreateMapping = vi.hoisted(() => vi.fn());
const mockMarkAiRequestCanceled = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
  client: {
    findMany: vi.fn(),
  },
  project: {
    findMany: vi.fn(),
  },
  workflowType: {
    findMany: vi.fn(),
  },
}));
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

vi.mock("@/lib/jobs/queue", () => ({
  enqueueJob: mockEnqueueJob,
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
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
  extractSelectedAssignmentState,
  extractSelectedClientId,
  extractSelectedProjectId,
  extractSelectedWorkflowTypeId,
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
const CLIENT_ID = "client_1";
const PROJECT_ID = "project_1";
const WORKFLOW_ID = "workflow_1";

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

function buildSelectValue(
  kind: "CLIENT" | "PROJECT" | "WORKFLOW",
  entityId: string,
) {
  return JSON.stringify({
    originalRequestId: AUDIT_ID,
    kind,
    entityId,
  });
}

function buildSelectionState(
  input: {
    clientId?: string;
    projectId?: string;
    workflowTypeId?: string;
  } = {},
) {
  return {
    values: {
      assignment_client: {
        assignment_select_client: {
          selected_option: {
            value: buildSelectValue("CLIENT", input.clientId ?? CLIENT_ID),
          },
        },
      },
      assignment_project: {
        assignment_select_project: {
          selected_option: {
            value: buildSelectValue("PROJECT", input.projectId ?? PROJECT_ID),
          },
        },
      },
      assignment_workflow: {
        assignment_select_workflow: {
          selected_option: {
            value: buildSelectValue("WORKFLOW", input.workflowTypeId ?? WORKFLOW_ID),
          },
        },
      },
    },
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
          assignment_client: {
            assignment_select_client: {
              selected_option: { value: "client_1" },
            },
          },
        },
      },
    });

    expect(clientId).toBe("client_1");
  });
});

describe("extractSelectedAssignmentState", () => {
  it("reads client, project, workflow, and audit id from encoded state values", () => {
    const payload = {
      state: buildSelectionState(),
    };

    expect(extractSelectedClientId(payload)).toBe(CLIENT_ID);
    expect(extractSelectedProjectId(payload)).toBe(PROJECT_ID);
    expect(extractSelectedWorkflowTypeId(payload)).toBe(WORKFLOW_ID);
    expect(extractSelectedAssignmentState(payload)).toEqual({
      originalRequestId: AUDIT_ID,
      clientId: CLIENT_ID,
      projectId: PROJECT_ID,
      workflowTypeId: WORKFLOW_ID,
    });
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
      clientId: CLIENT_ID,
      projectId: PROJECT_ID,
      workflowTypeId: WORKFLOW_ID,
      mappingStatus: "MAPPED",
    });
    mockDb.client.findMany.mockResolvedValue([
      { id: CLIENT_ID, name: "Acme Dental" },
    ]);
    mockDb.project.findMany.mockResolvedValue([
      {
        id: PROJECT_ID,
        name: "SEO Retainer",
        clientId: CLIENT_ID,
        client: { name: "Acme Dental" },
      },
    ]);
    mockDb.workflowType.findMany.mockResolvedValue([
      { id: WORKFLOW_ID, name: "Client Update" },
    ]);
  });

  it("assignment_cancel does not fetch original message or enqueue", async () => {
    await handleSlackInteractiveAction(
      buildPayload("assignment_cancel", "CANCEL"),
    );

    expect(mockFetchMessageText).not.toHaveBeenCalled();
    expect(mockEnqueueJob).not.toHaveBeenCalled();
    expect(mockCreateMapping).not.toHaveBeenCalled();
    expect(mockMarkAiRequestCanceled).toHaveBeenCalledWith(AUDIT_ID);
    expect(mockUpdateMessage).toHaveBeenCalledWith({
      channel: CHANNEL_ID,
      ts: ASSIGNMENT_MESSAGE_TS,
      text: "Canceled. No AI usage was recorded.",
      slackTeamId: TEAM_ID,
    });
  });

  it("assign_once enqueues metadata-only resume job and updates assignment message", async () => {
    await handleSlackInteractiveAction(
      buildPayload("assignment_assign_once", "ASSIGN_ONCE", {
        state: buildSelectionState(),
      }),
    );

    expect(mockFetchMessageText).not.toHaveBeenCalled();
    expect(mockCreateMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "ASSIGN_ONCE",
        clientId: CLIENT_ID,
        projectId: PROJECT_ID,
        workflowTypeId: WORKFLOW_ID,
      }),
    );
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "slack.ai_request",
      expect.objectContaining({
        aiRequestAuditId: AUDIT_ID,
        clientId: CLIENT_ID,
        projectId: PROJECT_ID,
        workflowTypeId: WORKFLOW_ID,
        messageTs: "333.444",
      }),
      expect.objectContaining({
        idempotencyKey: `slack:ai_request:audit:${AUDIT_ID}`,
      }),
    );
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "slack.ai_request",
      expect.not.objectContaining({ text: expect.any(String) }),
      expect.any(Object),
    );
    expect(mockUpdateMessage).toHaveBeenCalledWith({
      channel: CHANNEL_ID,
      ts: ASSIGNMENT_MESSAGE_TS,
      text: "Assigned this request once. Processing...",
      slackTeamId: TEAM_ID,
    });
  });

  it("map_channel persists mapping and updates assignment message", async () => {
    await handleSlackInteractiveAction(
      buildPayload("assignment_map_channel", "MAP_CHANNEL", {
        state: buildSelectionState(),
      }),
    );

    expect(mockCreateMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "MAP_CHANNEL",
        clientId: CLIENT_ID,
        projectId: PROJECT_ID,
        workflowTypeId: WORKFLOW_ID,
      }),
    );
    expect(mockUpdateMessage).toHaveBeenCalledWith({
      channel: CHANNEL_ID,
      ts: ASSIGNMENT_MESSAGE_TS,
      text: "Channel mapped. Processing...",
      slackTeamId: TEAM_ID,
    });
  });

  it("assign_internal enqueues metadata-only resume job and updates assignment message", async () => {
    await handleSlackInteractiveAction(
      buildPayload("assignment_internal", "ASSIGN_INTERNAL"),
    );

    expect(mockCreateMapping).not.toHaveBeenCalled();
    expect(mockFetchMessageText).not.toHaveBeenCalled();
    expect(mockEnqueueJob).toHaveBeenCalledWith(
      "slack.ai_request",
      expect.objectContaining({
        clientId: null,
        projectId: null,
        workflowTypeId: null,
        mappingStatus: "MAPPED",
        messageTs: "333.444",
      }),
      expect.objectContaining({
        idempotencyKey: `slack:ai_request:audit:${AUDIT_ID}`,
      }),
    );
    expect(mockUpdateMessage).toHaveBeenCalledWith({
      channel: CHANNEL_ID,
      ts: ASSIGNMENT_MESSAGE_TS,
      text: "Assigned as internal/no client. Processing...",
      slackTeamId: TEAM_ID,
    });
  });

  it("does not enqueue when original audit is missing", async () => {
    mockGetAudit.mockResolvedValue(null);

    await handleSlackInteractiveAction(
      buildPayload("assignment_internal", "ASSIGN_INTERNAL"),
    );

    expect(mockFetchMessageText).not.toHaveBeenCalled();
    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });

  it("does not enqueue when original audit is missing Slack metadata", async () => {
    mockGetAudit.mockResolvedValue({
      ...auditRecord,
      slackMessageTs: null,
    });

    await handleSlackInteractiveAction(
      buildPayload("assignment_internal", "ASSIGN_INTERNAL"),
    );

    expect(mockFetchMessageText).not.toHaveBeenCalled();
    expect(mockEnqueueJob).not.toHaveBeenCalled();
    expect(mockPostMessage).toHaveBeenCalled();
  });

  it("logs safely when assignment message update fails", async () => {
    mockUpdateMessage.mockRejectedValue(new Error("Slack update failed"));

    await handleSlackInteractiveAction(
      buildPayload("assignment_internal", "ASSIGN_INTERNAL"),
    );

    expect(mockEnqueueJob).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
    const loggedPayload = JSON.stringify(mockLogger.error.mock.calls);
    expect(loggedPayload).not.toContain(RECOVERED_TEXT);
  });

  it("does not log recovered Slack message text", async () => {
    await handleSlackInteractiveAction(
      buildPayload("assignment_internal", "ASSIGN_INTERNAL"),
    );

    const loggedPayload = JSON.stringify([
      ...mockLogger.info.mock.calls,
      ...mockLogger.warn.mock.calls,
      ...mockLogger.error.mock.calls,
    ]);
    expect(loggedPayload).not.toContain(RECOVERED_TEXT);
  });

  it("client select refreshes assignment UI without fetching Slack text or enqueueing", async () => {
    await handleSlackInteractiveAction({
      type: "block_actions",
      team: { id: TEAM_ID },
      user: { id: USER_ID },
      channel: { id: CHANNEL_ID, name: "general" },
      message: { ts: ASSIGNMENT_MESSAGE_TS },
      actions: [
        {
          action_id: "assignment_select_client",
          selected_option: {
            value: buildSelectValue("CLIENT", CLIENT_ID),
          },
        },
      ],
      state: buildSelectionState({ clientId: CLIENT_ID }),
    });

    expect(mockFetchMessageText).not.toHaveBeenCalled();
    expect(mockEnqueueJob).not.toHaveBeenCalled();
    expect(mockCreateMapping).not.toHaveBeenCalled();
    expect(mockUpdateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: CHANNEL_ID,
        ts: ASSIGNMENT_MESSAGE_TS,
        text: "Slate needs attribution before this AI request can be processed.",
        blocks: expect.any(Array),
      }),
    );
  });

  it("missing client selection refreshes assignment UI with a safe validation message", async () => {
    await handleSlackInteractiveAction(
      buildPayload("assignment_assign_once", "ASSIGN_ONCE"),
    );

    expect(mockCreateMapping).not.toHaveBeenCalled();
    expect(mockEnqueueJob).not.toHaveBeenCalled();
    expect(mockUpdateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: "section",
            text: expect.objectContaining({
              text: expect.stringContaining("Choose a client before using"),
            }),
          }),
        ]),
      }),
    );
  });

  it("project selection can infer the owning client for assign once", async () => {
    await handleSlackInteractiveAction(
      buildPayload("assignment_assign_once", "ASSIGN_ONCE", {
        state: {
          values: {
            assignment_project: {
              assignment_select_project: {
                selected_option: {
                  value: buildSelectValue("PROJECT", PROJECT_ID),
                },
              },
            },
          },
        },
      }),
    );

    expect(mockCreateMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: CLIENT_ID,
        projectId: PROJECT_ID,
      }),
    );
  });

  it("still supports the earlier local assign_once action id", async () => {
    await handleSlackInteractiveAction(
      buildPayload("assign_once", "ASSIGN_ONCE", {
        state: buildSelectionState(),
      }),
    );

    expect(mockCreateMapping).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "ASSIGN_ONCE" }),
    );
  });
});
