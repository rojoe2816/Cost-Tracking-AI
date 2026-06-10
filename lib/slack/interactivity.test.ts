import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAudit = vi.hoisted(() => vi.fn());
const mockEnqueueJob = vi.hoisted(() => vi.fn());
const mockCreateMapping = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ai/requests", () => ({
  getAiRequestAuditById: mockGetAudit,
}));

vi.mock("@/lib/jobs", () => ({
  enqueueJob: mockEnqueueJob,
}));

vi.mock("@/lib/slack/attribution", () => ({
  createOrUpdateSlackChannelMapping: mockCreateMapping,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
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

const auditRecord = {
  id: AUDIT_ID,
  organizationId: "org_1",
  slackTeamId: TEAM_ID,
  slackChannelId: CHANNEL_ID,
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
    mockCreateMapping.mockResolvedValue({
      organizationId: "org_1",
      clientId: "client_1",
      projectId: null,
      workflowTypeId: null,
      mappingStatus: "MAPPED",
    });
  });

  it("cancel_assignment does not enqueue or persist mapping", async () => {
    await handleSlackInteractiveAction(
      buildPayload("cancel_assignment", "CANCEL"),
    );

    expect(mockEnqueueJob).not.toHaveBeenCalled();
    expect(mockCreateMapping).not.toHaveBeenCalled();
  });

  it("assign_once does not persist mapping with MAP_CHANNEL", async () => {
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

    expect(mockCreateMapping).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "ASSIGN_ONCE" }),
    );
    expect(mockEnqueueJob).toHaveBeenCalledTimes(1);
  });

  it("map_channel persists mapping with MAP_CHANNEL", async () => {
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
    expect(mockEnqueueJob).toHaveBeenCalledTimes(1);
  });

  it("assign_internal enqueues with null client/project attribution", async () => {
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
        mappingStatus: "UNMAPPED",
      }),
    );
  });

  it("does not enqueue when original audit is missing", async () => {
    mockGetAudit.mockResolvedValue(null);

    await handleSlackInteractiveAction(
      buildPayload("assign_internal", "ASSIGN_INTERNAL"),
    );

    expect(mockEnqueueJob).not.toHaveBeenCalled();
  });
});
