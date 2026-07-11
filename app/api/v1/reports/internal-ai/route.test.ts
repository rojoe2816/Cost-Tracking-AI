import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthenticatePublicApiRequest = vi.hoisted(() => vi.fn());
const mockGetSpendByEmployee = vi.hoisted(() => vi.fn());
const mockGetSpendBySourceApp = vi.hoisted(() => vi.fn());
const mockGetSpendByTaskType = vi.hoisted(() => vi.fn());
const mockGetRecentInternalAiUsage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/public-api/auth", () => ({
  authenticatePublicApiRequest: mockAuthenticatePublicApiRequest,
}));

vi.mock("@/lib/analytics/internalUsage", () => ({
  getSpendByEmployee: mockGetSpendByEmployee,
  getSpendBySourceApp: mockGetSpendBySourceApp,
  getSpendByTaskType: mockGetSpendByTaskType,
  getRecentInternalAiUsage: mockGetRecentInternalAiUsage,
}));

import { GET } from "./route";

function seedOrgAReports() {
  mockGetSpendByEmployee.mockResolvedValue([
    {
      id: "emp_a",
      label: "Org A Employee",
      requests: 1,
      totalTokens: 10,
      promptTokens: 6,
      completionTokens: 4,
      spendUsd: 0.00001,
      avgCostPerRequest: 0.00001,
      latestUsageAt: new Date("2026-07-11T12:00:00.000Z"),
    },
  ]);
  mockGetSpendBySourceApp.mockResolvedValue([]);
  mockGetSpendByTaskType.mockResolvedValue([]);
  mockGetRecentInternalAiUsage.mockResolvedValue([
    {
      id: "usage_a",
      createdAt: new Date("2026-07-11T12:00:00.000Z"),
      employeeName: "Org A Employee",
      sourceAppName: "Company AI",
      clientName: "Acme Dental",
      projectName: "SEO Retainer",
      workflowName: "Client Update",
      taskType: "client_update",
      model: "gpt-4o-mini",
      provider: "openai",
      totalTokens: 10,
      spendUsd: 0.00001,
      externalLiteLlmRequestId: "chatcmpl_org_a",
    },
  ]);
}

describe("GET /api/v1/reports/internal-ai", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedOrgAReports();
  });

  it("scopes analytics queries to the authenticated organization only", async () => {
    mockAuthenticatePublicApiRequest.mockResolvedValue({
      ok: true,
      value: {
        organizationId: "org_a",
        sourceAppId: "app_a",
        credentialId: "cred_a",
        sourceAppName: "Company AI",
        sourceAppType: "internal_ai",
        scopes: ["reports:read"],
      },
    });

    const response = await GET(
      new Request("http://127.0.0.1:3000/api/v1/reports/internal-ai", {
        headers: { Authorization: "Bearer slate_app_sk_org_a" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetSpendByEmployee).toHaveBeenCalledWith("org_a");
    expect(mockGetSpendBySourceApp).toHaveBeenCalledWith("org_a");
    expect(mockGetSpendByTaskType).toHaveBeenCalledWith("org_a");
    expect(mockGetRecentInternalAiUsage).toHaveBeenCalledWith("org_a");
    expect(body.byEmployee[0].label).toBe("Org A Employee");
    expect(JSON.stringify(body)).not.toContain("keyHash");
    expect(JSON.stringify(body)).not.toContain("org_b");
  });

  it("rejects credentials that lack reports:read before querying another org", async () => {
    mockAuthenticatePublicApiRequest.mockResolvedValue({
      ok: false,
      status: 403,
      error: {
        code: "INSUFFICIENT_SCOPE",
        message: "API credential requires the reports:read scope.",
      },
    });

    const response = await GET(
      new Request("http://127.0.0.1:3000/api/v1/reports/internal-ai", {
        headers: { Authorization: "Bearer slate_app_sk_wrong_scope" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("INSUFFICIENT_SCOPE");
    expect(mockGetSpendByEmployee).not.toHaveBeenCalled();
    expect(mockGetRecentInternalAiUsage).not.toHaveBeenCalled();
  });
});
