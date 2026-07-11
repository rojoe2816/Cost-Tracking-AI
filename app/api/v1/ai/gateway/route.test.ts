import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProcess = vi.hoisted(() => vi.fn());

vi.mock("@/lib/public-api/gateway", () => ({
  processPublicGatewayRequest: mockProcess,
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";

describe("POST /api/v1/ai/gateway", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a stable request ID on validation errors", async () => {
    mockProcess.mockResolvedValue({
      ok: false,
      status: 401,
      value: {
        error: { code: "MISSING_AUTHORIZATION", message: "Authorization required." },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/v1/ai/gateway", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-Id": "contract-test-1",
        },
        body: JSON.stringify({ input: "hello" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBe("contract-test-1");
    expect(await response.json()).toEqual({
      requestId: "contract-test-1",
      error: { code: "MISSING_AUTHORIZATION", message: "Authorization required." },
    });
  });

  it("returns the versioned success contract and never echoes auth", async () => {
    mockProcess.mockResolvedValue({
      ok: true,
      status: 200,
      value: {
        requestId: "audit-1",
        response: "done",
        usage: {
          model: "gpt-4o-mini",
          provider: "openai",
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          costMicros: 1,
          latencyMs: 10,
        },
        attribution: {
          employeeExternalId: "emp-1",
          clientExternalId: null,
          projectExternalId: null,
          workflowExternalId: null,
          taskType: null,
          sourceAppRequestId: "source-1",
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/v1/ai/gateway", {
        method: "POST",
        headers: {
          Authorization: "Bearer slate_app_sk_secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: "hello" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.response).toBe("done");
    expect(JSON.stringify(body)).not.toContain("slate_app_sk_secret");
  });
});
