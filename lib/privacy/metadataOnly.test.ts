import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertMockCallsExcludeStrings,
  collectMockCalls,
  objectContainsString,
} from "@/tests/helpers/privacy";

const PROMPT_SENTINEL = "DO_NOT_STORE_THIS_PROMPT_SENTINEL";
const RESPONSE_SENTINEL = "DO_NOT_STORE_THIS_RESPONSE_SENTINEL";
const SYSTEM_SENTINEL = "DO_NOT_STORE_THIS_SYSTEM_PROMPT_SENTINEL";

const SLACK_AI_SYSTEM_PROMPT =
  "You are a helpful assistant responding in Slack. Be concise and clear.";

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

import { handleSlackAiRequestJob } from "@/lib/jobs/handlers/slackAiRequest";

const PERSISTENCE_SENTINELS = [
  PROMPT_SENTINEL,
  RESPONSE_SENTINEL,
  SYSTEM_SENTINEL,
  SLACK_AI_SYSTEM_PROMPT,
] as const;

describe("metadata-only privacy enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildUnmappedChannelAssignmentBlocks.mockReturnValue([{ type: "section" }]);
    mockPostSlackMessage.mockResolvedValue({ ts: "3333.0003" });
    mockUpdateSlackMessage.mockResolvedValue({ ts: "3333.0003" });
    mockCreateQueuedAiRequestAudit.mockResolvedValue({ id: "audit_queued" });
    mockCreateProcessingAiRequestAudit.mockResolvedValue({ id: "audit_processing" });
    mockResolveSlackAttribution.mockResolvedValue({
      organizationId: "org_1",
      clientId: "client_1",
      projectId: "project_1",
      workflowTypeId: "workflow_1",
      mappingStatus: "MAPPED",
    });
    mockSendLiteLlmChatCompletion.mockImplementation(async (input: {
      messages: Array<{ role: string; content: string }>;
    }) => {
      const userMessage = input.messages.find((message) => message.role === "user");

      expect(userMessage?.content).toContain(PROMPT_SENTINEL);

      return {
        content: `Here is the AI response. ${RESPONSE_SENTINEL}`,
        model: "gpt-4o-mini",
        provider: "openai",
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
        },
        costUsd: 0.001,
        litellmRequestId: "litellm-req-privacy-1",
      };
    });
  });

  it("metadata-only mode never stores prompt or response text", async () => {
    const payload = {
      organizationId: "org_1",
      slackTeamId: "T_DEMO",
      slackChannelId: "C_ACME",
      slackUserId: "U_DEMO",
      text: `Please draft a client update. ${PROMPT_SENTINEL}`,
      threadTs: "1111.0001",
      messageTs: "2222.0002",
    };

    await handleSlackAiRequestJob(payload);

    expect(mockSendLiteLlmChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining(PROMPT_SENTINEL),
          }),
          expect.objectContaining({
            role: "system",
            content: SLACK_AI_SYSTEM_PROMPT,
          }),
        ]),
      }),
    );

    expect(mockUpdateSlackMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(RESPONSE_SENTINEL),
      }),
    );

    const auditCalls = collectMockCalls(
      mockCreateQueuedAiRequestAudit,
      mockCreateProcessingAiRequestAudit,
      mockMarkAiRequestProcessing,
      mockMarkAiRequestCompleted,
      mockMarkAiRequestFailed,
    );

    assertMockCallsExcludeStrings(auditCalls, PERSISTENCE_SENTINELS);

    const usageCalls = collectMockCalls(mockCreateAiUsageEvent);
    assertMockCallsExcludeStrings(usageCalls, PERSISTENCE_SENTINELS);

    const loggerCalls = collectMockCalls(
      mockLogger.info,
      mockLogger.error,
      mockLogger.warn,
      mockLogger.debug,
    );
    assertMockCallsExcludeStrings(loggerCalls, PERSISTENCE_SENTINELS);

    expect(mockCreateProcessingAiRequestAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        clientId: "client_1",
        projectId: "project_1",
        workflowTypeId: "workflow_1",
        slackTeamId: "T_DEMO",
        slackChannelId: "C_ACME",
        slackUserId: "U_DEMO",
        slackThreadTs: "1111.0001",
        slackMessageTs: "2222.0002",
      }),
    );

    expect(mockCreateAiUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        aiRequestAuditId: "audit_processing",
        provider: "openai",
        model: "gpt-4o-mini",
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        externalLiteLlmRequestId: "litellm-req-privacy-1",
        clientId: "client_1",
        projectId: "project_1",
        workflowTypeId: "workflow_1",
      }),
    );
  });
});

describe("Prisma schema metadata-only storage", () => {
  const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
  const schema = readFileSync(schemaPath, "utf8");

  const forbiddenFieldPatterns = [
    /^\s*promptText\s+String/m,
    /^\s*responseText\s+String/m,
    /^\s*rawPrompt\s+String/m,
    /^\s*rawResponse\s+String/m,
    /^\s*rawSlackPayload\s+String/m,
    /^\s*rawLiteLlmResponse\s+String/m,
  ] as const;

  it("does not define raw prompt/response persistence fields", () => {
    for (const pattern of forbiddenFieldPatterns) {
      expect(schema).not.toMatch(pattern);
    }
  });
});

describe("privacy test helpers", () => {
  it("objectContainsString finds nested sentinel values", () => {
    expect(
      objectContainsString(
        { nested: [{ value: `prefix ${PROMPT_SENTINEL} suffix` }] },
        PROMPT_SENTINEL,
      ),
    ).toBe(true);
  });
});
