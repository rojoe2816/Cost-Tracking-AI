import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProcessInternalAiGatewayRequest = vi.hoisted(() => vi.fn());

vi.mock("./gateway", () => ({
  processInternalAiGatewayRequest: mockProcessInternalAiGatewayRequest,
}));

vi.mock("@/lib/env", () => ({
  env: {
    MOCK_COMPANY_SOURCE_APP_KEY: "slate_app_sk_test-server-key",
  },
}));

import { runCompanyAiTask } from "./companyAiRun";

const VALID_BODY = {
  employeeId: "emp_1",
  clientId: "client_1",
  projectId: "project_1",
  workflowTypeId: "workflow_1",
  taskType: "client_update",
  model: "gpt-4o-mini",
  input: "Draft a one-sentence client update.",
};

describe("runCompanyAiTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessInternalAiGatewayRequest.mockResolvedValue({
      ok: true,
      status: 200,
      value: {
        aiRequestAuditId: "audit_1",
        output: "Client update drafted.",
        usage: {
          provider: "openai",
          model: "gpt-4o-mini",
          promptTokens: 8,
          completionTokens: 6,
          totalTokens: 14,
          spendUsd: 0.0001,
          externalLiteLlmRequestId: "litellm-req-1234567890",
          latencyMs: 120,
        },
        attribution: {
          organizationId: "org_1",
          sourceAppId: "app_1",
          employeeId: "emp_1",
          clientId: "client_1",
          projectId: "project_1",
          workflowTypeId: "workflow_1",
          taskType: "client_update",
          sourceAppRequestId: "company-ai-test",
        },
      },
    });
  });

  it("rejects missing input", async () => {
    const result = await runCompanyAiTask({
      ...VALID_BODY,
      input: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
    expect(mockProcessInternalAiGatewayRequest).not.toHaveBeenCalled();
  });

  it("calls gateway with bearer auth server-side", async () => {
    await runCompanyAiTask(VALID_BODY);

    expect(mockProcessInternalAiGatewayRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationHeader: "Bearer slate_app_sk_test-server-key",
        body: expect.objectContaining({
          input: VALID_BODY.input,
          taskType: "client_update",
        }),
      }),
    );
  });

  it("returns response and usage metadata without exposing the raw key", async () => {
    const result = await runCompanyAiTask(VALID_BODY);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.output).toBe("Client update drafted.");
      expect(result.value.usage.model).toBe("gpt-4o-mini");
      expect(JSON.stringify(result.value)).not.toContain("slate_app_sk");
    }
  });

  it("does not include prompt or response storage fields", async () => {
    const result = await runCompanyAiTask(VALID_BODY);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toHaveProperty("promptText");
      expect(result.value).not.toHaveProperty("responseText");
    }
  });

  it("returns duplicate request errors from the gateway", async () => {
    mockProcessInternalAiGatewayRequest.mockResolvedValue({
      ok: false,
      status: 409,
      value: {
        error: {
          code: "DUPLICATE_SOURCE_APP_REQUEST",
          message: "Request with this sourceAppRequestId was already processed or is in progress.",
        },
      },
    });

    const result = await runCompanyAiTask(VALID_BODY);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.value.error.code).toBe("DUPLICATE_SOURCE_APP_REQUEST");
    }
  });

  it("returns provider failures from the gateway", async () => {
    mockProcessInternalAiGatewayRequest.mockResolvedValue({
      ok: false,
      status: 500,
      value: {
        error: {
          code: "GATEWAY_PROCESSING_FAILED",
          message: "LiteLLM unavailable",
        },
      },
    });

    const result = await runCompanyAiTask(VALID_BODY);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.value.error.code).toBe("GATEWAY_PROCESSING_FAILED");
    }
  });
});
