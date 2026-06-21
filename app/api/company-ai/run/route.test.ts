import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRunCompanyAiTask = vi.hoisted(() => vi.fn());

vi.mock("@/lib/internal-ai/companyAiRun", () => ({
  runCompanyAiTask: mockRunCompanyAiTask,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { POST } from "./route";

const VALID_BODY = {
  employeeId: "emp_1",
  clientId: "client_1",
  projectId: "project_1",
  workflowTypeId: "workflow_1",
  taskType: "client_update",
  model: "gpt-4o-mini",
  input: "Draft a one-sentence client update.",
};

describe("POST /api/company-ai/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 503 when source app key is not configured", async () => {
    mockRunCompanyAiTask.mockResolvedValue({
      ok: false,
      status: 503,
      value: {
        error: {
          code: "SOURCE_APP_KEY_NOT_CONFIGURED",
          message: "MOCK_COMPANY_SOURCE_APP_KEY is not configured.",
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/company-ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      }),
    );

    expect(response.status).toBe(503);
  });

  it("returns 400 for missing input", async () => {
    mockRunCompanyAiTask.mockResolvedValue({
      ok: false,
      status: 400,
      value: {
        error: {
          code: "INVALID_BODY",
          message: "Invalid request body.",
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/company-ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...VALID_BODY, input: "" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns safe success payload without secrets", async () => {
    mockRunCompanyAiTask.mockResolvedValue({
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
          externalLiteLlmRequestId: "litellm-abc",
          latencyMs: 120,
        },
        attribution: {
          employeeId: "emp_1",
          clientId: "client_1",
          projectId: "project_1",
          workflowTypeId: "workflow_1",
          taskType: "client_update",
          sourceAppRequestId: "company-ai-test",
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/company-ai/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.output).toBe("Client update drafted.");
    expect(body).not.toHaveProperty("keyHash");
    expect(body).not.toHaveProperty("promptText");
    expect(body).not.toHaveProperty("responseText");
    expect(JSON.stringify(body)).not.toContain("slate_app_sk");
  });
});
