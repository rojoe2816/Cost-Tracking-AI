import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProcessInternalAiGatewayRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/internal-ai/gateway", () => ({
  processInternalAiGatewayRequest: mockProcessInternalAiGatewayRequest,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET, POST } from "./route";

describe("POST /api/ai/gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when auth is missing", async () => {
    mockProcessInternalAiGatewayRequest.mockResolvedValue({
      ok: false,
      status: 401,
      value: {
        error: {
          code: "MISSING_AUTHORIZATION",
          message: "Missing Authorization header.",
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/ai/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: "hello" }),
      }),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("MISSING_AUTHORIZATION");
  });

  it("returns 400 for invalid body", async () => {
    mockProcessInternalAiGatewayRequest.mockResolvedValue({
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
      new Request("http://localhost/api/ai/gateway", {
        method: "POST",
        headers: {
          Authorization: "Bearer slate_app_sk_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "gpt-4o-mini" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 200 with safe response for valid request", async () => {
    mockProcessInternalAiGatewayRequest.mockResolvedValue({
      ok: true,
      status: 200,
      value: {
        aiRequestAuditId: "audit_1",
        output: "Gateway response text.",
        usage: {
          provider: "openai",
          model: "gpt-4o-mini",
          promptTokens: 5,
          completionTokens: 3,
          totalTokens: 8,
          spendUsd: 0.001,
          externalLiteLlmRequestId: "litellm-1",
          latencyMs: 120,
        },
        attribution: {
          organizationId: "org_demo",
          sourceAppId: "app_portal",
          employeeId: "emp_1",
          clientId: null,
          projectId: null,
          workflowTypeId: null,
          taskType: null,
          sourceAppRequestId: null,
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/ai/gateway", {
        method: "POST",
        headers: {
          Authorization: "Bearer slate_app_sk_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: "hello" }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.output).toBe("Gateway response text.");
    expect(body.usage.model).toBe("gpt-4o-mini");
    expect(body).not.toHaveProperty("keyHash");
    expect(body).not.toHaveProperty("promptText");
    expect(body).not.toHaveProperty("responseText");
    expect(JSON.stringify(body)).not.toContain("slate_app_sk_test");
  });

  it("returns 400 for invalid JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockProcessInternalAiGatewayRequest).not.toHaveBeenCalled();
  });
});

describe("GET /api/ai/gateway", () => {
  it("returns 405 method not allowed", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
  });
});
