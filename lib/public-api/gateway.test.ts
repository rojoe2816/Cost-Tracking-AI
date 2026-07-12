import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthenticate = vi.hoisted(() => vi.fn());
const mockModelAllowed = vi.hoisted(() => vi.fn());
const mockProcessGateway = vi.hoisted(() => vi.fn());

vi.mock("./auth", () => ({
  authenticatePublicApiAuthorizationHeader: mockAuthenticate,
}));
vi.mock("./modelAccess", () => ({
  isOrganizationModelAllowed: mockModelAllowed,
}));
vi.mock("@/lib/internal-ai/gateway", () => ({
  processInternalAiGatewayRequest: mockProcessGateway,
}));

import { processPublicGatewayRequest } from "./gateway";

const validBody = {
  employeeExternalId: "emp-104",
  clientExternalId: "client-acme",
  projectExternalId: "project-seo",
  workflowExternalId: "client-update",
  taskType: "client_update",
  sourceAppRequestId: "request-001",
  model: "gpt-4o-mini",
  input: "Draft a brief client update.",
};

describe("processPublicGatewayRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockResolvedValue({
      ok: true,
      value: {
        organizationId: "org_a",
        sourceAppId: "app_a",
        credentialId: "cred_a",
        sourceAppName: "Company AI",
        sourceAppType: "internal_ai",
        scopes: ["ai:run"],
      },
    });
    mockModelAllowed.mockResolvedValue(true);
    mockProcessGateway.mockResolvedValue({
      ok: true,
      status: 200,
      value: {
        aiRequestAuditId: "audit_123",
        output: "A polished client update.",
        usage: {
          provider: "openai",
          model: "gpt-4o-mini",
          promptTokens: 20,
          completionTokens: 18,
          totalTokens: 38,
          costMicros: 11,
          spendUsd: 0.000011,
          externalLiteLlmRequestId: "llm_123",
          latencyMs: 500,
        },
        attribution: {
          organizationId: "org_a",
          sourceAppId: "app_a",
          employeeId: "internal_employee",
          clientId: "internal_client",
          projectId: "internal_project",
          workflowTypeId: "internal_workflow",
          taskType: "client_update",
          sourceAppRequestId: "request-001",
        },
      },
    });
  });

  it("returns the documented external-ID response without internal IDs", async () => {
    const result = await processPublicGatewayRequest({
      authorizationHeader: "Bearer slate_app_sk_test",
      body: validBody,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        requestId: "audit_123",
        response: "A polished client update.",
        usage: { inputTokens: 20, outputTokens: 18, costMicros: 11 },
        attribution: {
          employeeExternalId: "emp-104",
          clientExternalId: "client-acme",
          sourceAppRequestId: "request-001",
        },
      });
      expect(JSON.stringify(result.value)).not.toContain("internal_employee");
      expect(JSON.stringify(result.value)).not.toContain("slate_app_sk_test");
    }
  });

  it("rejects a model outside the organization allowlist before the gateway", async () => {
    mockModelAllowed.mockResolvedValue(false);

    const result = await processPublicGatewayRequest({
      authorizationHeader: "Bearer slate_app_sk_test",
      body: { ...validBody, model: "unapproved-model" },
    });

    expect(result).toMatchObject({
      ok: false,
      status: 400,
      value: { error: { code: "MODEL_NOT_ALLOWED" } },
    });
    expect(mockProcessGateway).not.toHaveBeenCalled();
  });

  it("preserves duplicate request protection", async () => {
    mockProcessGateway.mockResolvedValue({
      ok: false,
      status: 409,
      value: {
        error: {
          code: "DUPLICATE_SOURCE_APP_REQUEST",
          message: "Duplicate request.",
        },
      },
    });

    const result = await processPublicGatewayRequest({
      authorizationHeader: "Bearer slate_app_sk_test",
      body: validBody,
    });

    expect(result).toMatchObject({ ok: false, status: 409 });
  });

  it("sanitizes provider failures", async () => {
    mockProcessGateway.mockResolvedValue({
      ok: false,
      status: 500,
      value: {
        error: {
          code: "GATEWAY_PROCESSING_FAILED",
          message: "provider stack trace with secret details",
        },
      },
    });

    const result = await processPublicGatewayRequest({
      authorizationHeader: "Bearer slate_app_sk_test",
      body: validBody,
    });

    expect(JSON.stringify(result)).not.toContain("secret details");
  });

  it("rejects invalid input before authentication", async () => {
    const result = await processPublicGatewayRequest({
      authorizationHeader: null,
      body: { sourceAppRequestId: "request-001" },
    });

    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });
});
