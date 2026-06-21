import { beforeEach, describe, expect, it, vi } from "vitest";

const mockParseBearerToken = vi.hoisted(() => vi.fn());
const mockAuthenticateSourceAppRequest = vi.hoisted(() => vi.fn());
const mockValidateInternalAiAttribution = vi.hoisted(() => vi.fn());
const mockCreateProcessingAiRequestAudit = vi.hoisted(() => vi.fn());
const mockMarkAiRequestCompleted = vi.hoisted(() => vi.fn());
const mockMarkAiRequestFailed = vi.hoisted(() => vi.fn());
const mockCreateAiUsageEvent = vi.hoisted(() => vi.fn());
const mockSendLiteLlmChatCompletion = vi.hoisted(() => vi.fn());
const mockResolveLiteLlmCompletionForPersistence = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
  aiRequestAudit: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("./sourceAppAuth", () => ({
  parseBearerToken: mockParseBearerToken,
  authenticateSourceAppRequest: mockAuthenticateSourceAppRequest,
}));

vi.mock("./usageAttribution", () => ({
  validateInternalAiAttribution: mockValidateInternalAiAttribution,
}));

vi.mock("@/lib/ai/requests", () => ({
  createProcessingAiRequestAudit: mockCreateProcessingAiRequestAudit,
  markAiRequestCompleted: mockMarkAiRequestCompleted,
  markAiRequestFailed: mockMarkAiRequestFailed,
  createAiUsageEvent: mockCreateAiUsageEvent,
}));

vi.mock("@/lib/litellm/client", () => ({
  sendLiteLlmChatCompletion: mockSendLiteLlmChatCompletion,
}));

vi.mock("@/lib/litellm/resolveCompletion", () => ({
  resolveLiteLlmCompletionForPersistence: mockResolveLiteLlmCompletionForPersistence,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { processInternalAiGatewayRequest } from "./gateway";
import {
  validateInternalAiGatewayBody,
} from "./gatewayTypes";

const ORG_ID = "org_demo";
const SOURCE_APP_ID = "app_portal";
const EMPLOYEE_ID = "emp_tucker";
const CLIENT_ID = "client_1";
const PROJECT_ID = "project_1";
const WORKFLOW_ID = "workflow_1";
const AUDIT_ID = "audit_gateway_1";
const RAW_KEY = "slate_app_sk_test-secret-key-value";

const VALID_BODY = {
  employeeId: EMPLOYEE_ID,
  clientId: CLIENT_ID,
  projectId: PROJECT_ID,
  workflowTypeId: WORKFLOW_ID,
  taskType: "client_update",
  sourceAppRequestId: "req-001",
  model: "gpt-4o-mini",
  input: "Summarize the client update in one sentence.",
};

const AUTH_VALUE = {
  organizationId: ORG_ID,
  sourceAppId: SOURCE_APP_ID,
  credentialId: "cred_1",
  sourceAppName: "Mock Company AI Portal",
  sourceAppType: "mock_company_portal",
};

const ATTRIBUTION_VALUE = {
  organizationId: ORG_ID,
  employeeId: EMPLOYEE_ID,
  sourceAppId: SOURCE_APP_ID,
  clientId: CLIENT_ID,
  projectId: PROJECT_ID,
  workflowTypeId: WORKFLOW_ID,
  taskType: "client_update",
};

const RESOLVED_COMPLETION = {
  content: "Client update summary response.",
  provider: "openai",
  model: "gpt-4o-mini",
  usage: {
    inputTokens: 12,
    outputTokens: 8,
    totalTokens: 20,
  },
  costUsd: 0.0025,
  externalLiteLlmRequestId: "litellm-req-gateway-1",
};

describe("gatewayTypes", () => {
  it("rejects prompt/response storage fields", () => {
    const result = validateInternalAiGatewayBody({
      input: "hello",
      promptText: "secret",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PROMPT_OR_RESPONSE_NOT_ALLOWED");
    }
  });

  it("rejects missing input", () => {
    const result = validateInternalAiGatewayBody({
      model: "gpt-4o-mini",
    });

    expect(result.ok).toBe(false);
  });
});

describe("processInternalAiGatewayRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParseBearerToken.mockReturnValue({ ok: true, value: RAW_KEY });
    mockAuthenticateSourceAppRequest.mockResolvedValue({
      ok: true,
      value: AUTH_VALUE,
    });
    mockValidateInternalAiAttribution.mockResolvedValue({
      ok: true,
      value: ATTRIBUTION_VALUE,
    });
    mockDb.aiRequestAudit.findFirst.mockResolvedValue(null);
    mockCreateProcessingAiRequestAudit.mockResolvedValue({ id: AUDIT_ID });
    mockSendLiteLlmChatCompletion.mockResolvedValue({
      content: "raw completion",
      model: "gpt-4o-mini",
      provider: "openai",
      usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 },
      costUsd: 0.0025,
      externalLiteLlmRequestId: "litellm-req-gateway-1",
    });
    mockResolveLiteLlmCompletionForPersistence.mockResolvedValue(RESOLVED_COMPLETION);
    mockMarkAiRequestCompleted.mockResolvedValue(undefined);
    mockMarkAiRequestFailed.mockResolvedValue(undefined);
    mockCreateAiUsageEvent.mockResolvedValue(undefined);
  });

  it("rejects missing bearer token with 401", async () => {
    mockParseBearerToken.mockReturnValue({
      ok: false,
      error: { code: "MISSING_AUTHORIZATION", message: "Missing Authorization header." },
    });

    const result = await processInternalAiGatewayRequest({
      authorizationHeader: null,
      body: VALID_BODY,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.value.error.code).toBe("MISSING_AUTHORIZATION");
    }
    expect(mockSendLiteLlmChatCompletion).not.toHaveBeenCalled();
    expect(mockCreateAiUsageEvent).not.toHaveBeenCalled();
  });

  it("rejects invalid bearer token", async () => {
    mockAuthenticateSourceAppRequest.mockResolvedValue({
      ok: false,
      error: { code: "INVALID_API_KEY", message: "Invalid API key." },
    });

    const result = await processInternalAiGatewayRequest({
      authorizationHeader: "Bearer invalid",
      body: VALID_BODY,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.value.error.code).toBe("INVALID_API_KEY");
    }
    expect(mockSendLiteLlmChatCompletion).not.toHaveBeenCalled();
  });

  it("rejects revoked credential with 403", async () => {
    mockAuthenticateSourceAppRequest.mockResolvedValue({
      ok: false,
      error: { code: "CREDENTIAL_REVOKED", message: "Credential revoked." },
    });

    const result = await processInternalAiGatewayRequest({
      authorizationHeader: `Bearer ${RAW_KEY}`,
      body: VALID_BODY,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.value.error.code).toBe("CREDENTIAL_REVOKED");
    }
  });

  it("rejects inactive source app with 403", async () => {
    mockAuthenticateSourceAppRequest.mockResolvedValue({
      ok: false,
      error: { code: "SOURCE_APP_INACTIVE", message: "Source app inactive." },
    });

    const result = await processInternalAiGatewayRequest({
      authorizationHeader: `Bearer ${RAW_KEY}`,
      body: VALID_BODY,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it("rejects missing input with 400", async () => {
    const result = await processInternalAiGatewayRequest({
      authorizationHeader: `Bearer ${RAW_KEY}`,
      body: { model: "gpt-4o-mini" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
    expect(mockSendLiteLlmChatCompletion).not.toHaveBeenCalled();
  });

  it("rejects cross-org attribution with 400", async () => {
    mockValidateInternalAiAttribution.mockResolvedValue({
      ok: false,
      error: {
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee not found in organization.",
      },
    });

    const result = await processInternalAiGatewayRequest({
      authorizationHeader: `Bearer ${RAW_KEY}`,
      body: VALID_BODY,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.value.error.code).toBe("EMPLOYEE_NOT_FOUND");
    }
    expect(mockCreateProcessingAiRequestAudit).not.toHaveBeenCalled();
  });

  it("rejects duplicate sourceAppRequestId with 409", async () => {
    mockDb.aiRequestAudit.findFirst.mockResolvedValue({
      id: "audit_existing",
      status: "COMPLETED",
    });

    const result = await processInternalAiGatewayRequest({
      authorizationHeader: `Bearer ${RAW_KEY}`,
      body: VALID_BODY,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.value.error.code).toBe("DUPLICATE_SOURCE_APP_REQUEST");
    }
    expect(mockCreateProcessingAiRequestAudit).not.toHaveBeenCalled();
    expect(mockSendLiteLlmChatCompletion).not.toHaveBeenCalled();
  });

  it("processes valid request and returns output with usage metadata", async () => {
    const result = await processInternalAiGatewayRequest({
      authorizationHeader: `Bearer ${RAW_KEY}`,
      body: VALID_BODY,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.value.output).toBe(RESOLVED_COMPLETION.content);
      expect(result.value.aiRequestAuditId).toBe(AUDIT_ID);
      expect(result.value.usage).toMatchObject({
        provider: "openai",
        model: "gpt-4o-mini",
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20,
        externalLiteLlmRequestId: "litellm-req-gateway-1",
      });
      expect(result.value.attribution).toMatchObject({
        organizationId: ORG_ID,
        sourceAppId: SOURCE_APP_ID,
        employeeId: EMPLOYEE_ID,
        taskType: "client_update",
      });
    }
  });

  it("calls LiteLLM once for valid request", async () => {
    await processInternalAiGatewayRequest({
      authorizationHeader: `Bearer ${RAW_KEY}`,
      body: VALID_BODY,
    });

    expect(mockSendLiteLlmChatCompletion).toHaveBeenCalledTimes(1);
    expect(mockSendLiteLlmChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: VALID_BODY.input }],
        metadata: expect.objectContaining({
          organization_id: ORG_ID,
          source: "web",
          app_request_id: AUDIT_ID,
        }),
      }),
    );
  });

  it("creates AiRequestAudit and AiUsageEvent with attribution fields", async () => {
    await processInternalAiGatewayRequest({
      authorizationHeader: `Bearer ${RAW_KEY}`,
      body: VALID_BODY,
    });

    expect(mockCreateProcessingAiRequestAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        source: "WEB",
        employeeId: EMPLOYEE_ID,
        sourceAppId: SOURCE_APP_ID,
        taskType: "client_update",
        sourceAppRequestId: "req-001",
      }),
    );

    expect(mockCreateAiUsageEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        aiRequestAuditId: AUDIT_ID,
        source: "WEB",
        employeeId: EMPLOYEE_ID,
        sourceAppId: SOURCE_APP_ID,
        taskType: "client_update",
        provider: "openai",
        model: "gpt-4o-mini",
        promptTokens: 12,
        completionTokens: 8,
        totalTokens: 20,
        externalLiteLlmRequestId: "litellm-req-gateway-1",
      }),
    );

    const usageArgs = mockCreateAiUsageEvent.mock.calls[0]?.[0];
    expect(usageArgs).not.toHaveProperty("promptText");
    expect(usageArgs).not.toHaveProperty("responseText");
    expect(usageArgs?.input).toBeUndefined();
    expect(String(usageArgs?.totalCostMicros ?? "")).not.toContain(VALID_BODY.input);
  });

  it("marks audit completed on success", async () => {
    await processInternalAiGatewayRequest({
      authorizationHeader: `Bearer ${RAW_KEY}`,
      body: VALID_BODY,
    });

    expect(mockMarkAiRequestCompleted).toHaveBeenCalledWith(
      AUDIT_ID,
      "litellm-req-gateway-1",
    );
  });

  it("marks audit failed and skips usage event when LiteLLM fails", async () => {
    mockSendLiteLlmChatCompletion.mockRejectedValue(new Error("LiteLLM unavailable"));

    const result = await processInternalAiGatewayRequest({
      authorizationHeader: `Bearer ${RAW_KEY}`,
      body: VALID_BODY,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.value.error.code).toBe("GATEWAY_PROCESSING_FAILED");
    }
    expect(mockMarkAiRequestFailed).toHaveBeenCalledWith(
      AUDIT_ID,
      "LiteLLM unavailable",
    );
    expect(mockCreateAiUsageEvent).not.toHaveBeenCalled();
  });
});
