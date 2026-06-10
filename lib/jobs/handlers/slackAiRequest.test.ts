import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResolveSlackAttribution = vi.hoisted(() => vi.fn());
const mockCreateQueuedAiRequestAudit = vi.hoisted(() => vi.fn());
const mockCreateProcessingAiRequestAudit = vi.hoisted(() => vi.fn());
const mockMarkAiRequestProcessing = vi.hoisted(() => vi.fn());
const mockMarkAiRequestCompleted = vi.hoisted(() => vi.fn());
const mockMarkAiRequestFailed = vi.hoisted(() => vi.fn());
const mockCreateAiUsageEvent = vi.hoisted(() => vi.fn());
const mockSendLiteLlmChatCompletion = vi.hoisted(() => vi.fn());
const mockPostSlackMessage = vi.hoisted(() => vi.fn());
const mockUpdateSlackMessage = vi.hoisted(() => vi.fn());
const mockBuildUnmappedChannelAssignmentBlocks = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
  client: {
    findMany: vi.fn(),
  },
}));
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/slack/attribution", () => ({
  resolveSlackAttribution: mockResolveSlackAttribution,
}));

vi.mock("@/lib/ai/requests", () => ({
  createQueuedAiRequestAudit: mockCreateQueuedAiRequestAudit,
  createProcessingAiRequestAudit: mockCreateProcessingAiRequestAudit,
  markAiRequestProcessing: mockMarkAiRequestProcessing,
  markAiRequestCompleted: mockMarkAiRequestCompleted,
  markAiRequestFailed: mockMarkAiRequestFailed,
  createAiUsageEvent: mockCreateAiUsageEvent,
}));

vi.mock("@/lib/litellm/client", () => ({
  sendLiteLlmChatCompletion: mockSendLiteLlmChatCompletion,
}));

vi.mock("@/lib/slack/client", () => ({
  postMessage: mockPostSlackMessage,
  updateMessage: mockUpdateSlackMessage,
}));

vi.mock("@/lib/slack/blocks", () => ({
  buildUnmappedChannelAssignmentBlocks: mockBuildUnmappedChannelAssignmentBlocks,
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));

import { handleSlackAiRequestJob } from "./slackAiRequest";

const BASE_PAYLOAD = {
  organizationId: "org_1",
  slackTeamId: "T_TEST",
  slackChannelId: "C_TEST",
  slackUserId: "U_TEST",
  text: "Secret prompt text that must not be stored",
  threadTs: "1111.0001",
  messageTs: "2222.0002",
};

describe("handleSlackAiRequestJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildUnmappedChannelAssignmentBlocks.mockReturnValue([{ type: "section" }]);
    mockPostSlackMessage.mockResolvedValue({ ts: "3333.0003" });
    mockUpdateSlackMessage.mockResolvedValue({ ts: "3333.0003" });
    mockCreateQueuedAiRequestAudit.mockResolvedValue({ id: "audit_queued" });
    mockCreateProcessingAiRequestAudit.mockResolvedValue({ id: "audit_processing" });
    mockSendLiteLlmChatCompletion.mockResolvedValue({
      content: "Assistant response text",
      model: "gpt-4o-mini",
      provider: "openai",
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      },
      costUsd: 0.001,
      litellmRequestId: "litellm-req-1",
    });
    mockDb.client.findMany.mockResolvedValue([{ id: "client_1", name: "Client One" }]);
  });

  it("posts workspace-not-connected message for UNKNOWN_WORKSPACE and skips LiteLLM", async () => {
    mockResolveSlackAttribution.mockResolvedValue({
      organizationId: null,
      clientId: null,
      projectId: null,
      workflowTypeId: null,
      mappingStatus: "UNKNOWN_WORKSPACE",
    });

    await handleSlackAiRequestJob(BASE_PAYLOAD);

    expect(mockPostSlackMessage).toHaveBeenCalledWith({
      channel: "C_TEST",
      text: expect.stringContaining("not connected to Cost Tracking AI"),
      threadTs: "1111.0001",
    });
    expect(mockSendLiteLlmChatCompletion).not.toHaveBeenCalled();
    expect(mockCreateQueuedAiRequestAudit).not.toHaveBeenCalled();
    expect(mockCreateProcessingAiRequestAudit).not.toHaveBeenCalled();
  });

  it("creates queued audit and posts assignment blocks for UNMAPPED", async () => {
    mockResolveSlackAttribution.mockResolvedValue({
      organizationId: "org_1",
      clientId: null,
      projectId: null,
      workflowTypeId: null,
      mappingStatus: "UNMAPPED",
    });

    await handleSlackAiRequestJob(BASE_PAYLOAD);

    expect(mockCreateQueuedAiRequestAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        source: "SLACK",
        slackTeamId: "T_TEST",
        slackChannelId: "C_TEST",
        slackUserId: "U_TEST",
      }),
    );
    expect(mockCreateQueuedAiRequestAudit.mock.calls[0]?.[0]).not.toHaveProperty(
      "text",
    );
    expect(mockBuildUnmappedChannelAssignmentBlocks).toHaveBeenCalledWith({
      clients: [{ id: "client_1", name: "Client One" }],
      originalRequestId: "audit_queued",
    });
    expect(mockPostSlackMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [{ type: "section" }],
      }),
    );
    expect(mockSendLiteLlmChatCompletion).not.toHaveBeenCalled();
  });

  it("processes MAPPED requests through LiteLLM and updates Slack", async () => {
    mockResolveSlackAttribution.mockResolvedValue({
      organizationId: "org_1",
      clientId: "client_1",
      projectId: "project_1",
      workflowTypeId: "workflow_1",
      mappingStatus: "MAPPED",
    });

    await handleSlackAiRequestJob(BASE_PAYLOAD);

    expect(mockCreateProcessingAiRequestAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        clientId: "client_1",
        projectId: "project_1",
        workflowTypeId: "workflow_1",
      }),
    );
    expect(mockPostSlackMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Thinking...",
      }),
    );
    expect(mockSendLiteLlmChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "user", content: BASE_PAYLOAD.text }),
        ]),
        metadata: expect.objectContaining({
          organization_id: "org_1",
          app_request_id: "audit_processing",
          source: "slack",
          client_id: "client_1",
        }),
      }),
    );
    expect(mockMarkAiRequestCompleted).toHaveBeenCalledWith(
      "audit_processing",
      "litellm-req-1",
    );
    expect(mockCreateAiUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        aiRequestAuditId: "audit_processing",
        provider: "openai",
        model: "gpt-4o-mini",
      }),
    );
    expect(mockUpdateSlackMessage).toHaveBeenCalledWith({
      channel: "C_TEST",
      ts: "3333.0003",
      text: "Assistant response text",
    });
  });

  it("marks audit failed and updates Slack on mapped processing errors", async () => {
    mockResolveSlackAttribution.mockResolvedValue({
      organizationId: "org_1",
      clientId: "client_1",
      projectId: null,
      workflowTypeId: null,
      mappingStatus: "MAPPED",
    });
    mockSendLiteLlmChatCompletion.mockRejectedValue(new Error("LiteLLM proxy request failed"));

    await handleSlackAiRequestJob(BASE_PAYLOAD);

    expect(mockMarkAiRequestFailed).toHaveBeenCalledWith(
      "audit_processing",
      "LiteLLM proxy request failed",
    );
    expect(mockUpdateSlackMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Sorry, I could not complete that AI request"),
      }),
    );
  });

  it("does not store prompt or AI response text in audit helpers", async () => {
    mockResolveSlackAttribution.mockResolvedValue({
      organizationId: "org_1",
      clientId: null,
      projectId: null,
      workflowTypeId: null,
      mappingStatus: "UNMAPPED",
    });

    await handleSlackAiRequestJob(BASE_PAYLOAD);

    for (const call of mockCreateQueuedAiRequestAudit.mock.calls) {
      expect(JSON.stringify(call[0])).not.toContain("Secret prompt text");
      expect(JSON.stringify(call[0])).not.toContain("Assistant response text");
    }

    for (const call of mockMarkAiRequestCompleted.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("Secret prompt text");
      expect(JSON.stringify(call)).not.toContain("Assistant response text");
    }
  });

  it("does not log raw prompt or response text", async () => {
    mockResolveSlackAttribution.mockResolvedValue({
      organizationId: "org_1",
      clientId: "client_1",
      projectId: null,
      workflowTypeId: null,
      mappingStatus: "MAPPED",
    });

    await handleSlackAiRequestJob(BASE_PAYLOAD);

    const loggedPayload = JSON.stringify([
      ...mockLogger.info.mock.calls,
      ...mockLogger.error.mock.calls,
    ]);
    expect(loggedPayload).not.toContain("Secret prompt text that must not be stored");
    expect(loggedPayload).not.toContain("Assistant response text");
  });
});
