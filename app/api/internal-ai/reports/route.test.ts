import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetDemoOrganization = vi.hoisted(() => vi.fn());
const mockGetSpendByEmployee = vi.hoisted(() => vi.fn());
const mockGetSpendBySourceApp = vi.hoisted(() => vi.fn());
const mockGetSpendByTaskType = vi.hoisted(() => vi.fn());
const mockGetRecentInternalAiUsage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/slack/mappings", () => ({
  getDemoOrganization: mockGetDemoOrganization,
}));

vi.mock("@/lib/analytics/internalUsage", () => ({
  getSpendByEmployee: mockGetSpendByEmployee,
  getSpendBySourceApp: mockGetSpendBySourceApp,
  getSpendByTaskType: mockGetSpendByTaskType,
  getRecentInternalAiUsage: mockGetRecentInternalAiUsage,
}));

import { GET } from "./route";

const ORG = { id: "org_demo", name: "Demo Agency" };

function seedReportMocks() {
  mockGetDemoOrganization.mockResolvedValue(ORG);
  mockGetSpendByEmployee.mockResolvedValue([
    {
      id: "emp_1",
      label: "Tucker Hawkins",
      requests: 1,
      totalTokens: 12,
      promptTokens: 8,
      completionTokens: 4,
      spendUsd: 0.00001,
      avgCostPerRequest: 0.00001,
      latestUsageAt: new Date("2026-06-21T12:00:00.000Z"),
    },
  ]);
  mockGetSpendBySourceApp.mockResolvedValue([
    {
      id: "app_1",
      label: "Mock Company AI Portal",
      requests: 1,
      totalTokens: 12,
      promptTokens: 8,
      completionTokens: 4,
      spendUsd: 0.00001,
      avgCostPerRequest: 0.00001,
      latestUsageAt: new Date("2026-06-21T12:00:00.000Z"),
    },
  ]);
  mockGetSpendByTaskType.mockResolvedValue([
    {
      id: "client_update",
      label: "client_update",
      requests: 1,
      totalTokens: 12,
      promptTokens: 8,
      completionTokens: 4,
      spendUsd: 0.00001,
      avgCostPerRequest: 0.00001,
      latestUsageAt: new Date("2026-06-21T12:00:00.000Z"),
    },
  ]);
  mockGetRecentInternalAiUsage.mockResolvedValue([
    {
      id: "usage_1",
      createdAt: new Date("2026-06-21T12:00:00.000Z"),
      employeeName: "Tucker Hawkins",
      sourceAppName: "Mock Company AI Portal",
      clientName: "Acme Dental",
      projectName: "SEO Retainer",
      workflowName: "Client Update",
      taskType: "client_update",
      model: "gpt-4o-mini",
      provider: "openai",
      totalTokens: 12,
      spendUsd: 0.00001,
      externalLiteLlmRequestId: "chatcmpl_safe",
    },
  ]);
}

describe("GET /api/internal-ai/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedReportMocks();
  });

  it("returns byEmployee", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.byEmployee[0].label).toBe("Tucker Hawkins");
  });

  it("returns bySourceApp", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.bySourceApp[0].label).toBe("Mock Company AI Portal");
  });

  it("returns byTaskType", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.byTaskType[0].label).toBe("client_update");
  });

  it("returns recent usage", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.recent[0]).toMatchObject({
      employeeName: "Tucker Hawkins",
      sourceAppName: "Mock Company AI Portal",
      taskType: "client_update",
    });
  });

  it("handles empty usage safely", async () => {
    mockGetSpendByEmployee.mockResolvedValue([]);
    mockGetSpendBySourceApp.mockResolvedValue([]);
    mockGetSpendByTaskType.mockResolvedValue([]);
    mockGetRecentInternalAiUsage.mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.byEmployee).toEqual([]);
    expect(body.bySourceApp).toEqual([]);
    expect(body.byTaskType).toEqual([]);
    expect(body.recent).toEqual([]);
  });

  it("does not expose prompt or response fields", async () => {
    const response = await GET();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain("promptText");
    expect(serialized).not.toContain("responseText");
    expect(serialized).not.toContain("rawPrompt");
    expect(serialized).not.toContain("rawResponse");
  });

  it("does not expose raw keys or key hashes", async () => {
    const response = await GET();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain("rawKey");
    expect(serialized).not.toContain("keyHash");
    expect(serialized).not.toContain("slate_app_sk_");
  });

  it("uses AiUsageEvent-backed analytics helpers for the demo organization", async () => {
    await GET();

    expect(mockGetSpendByEmployee).toHaveBeenCalledWith(ORG.id);
    expect(mockGetSpendBySourceApp).toHaveBeenCalledWith(ORG.id);
    expect(mockGetSpendByTaskType).toHaveBeenCalledWith(ORG.id);
    expect(mockGetRecentInternalAiUsage).toHaveBeenCalledWith(ORG.id);
  });

  it("returns 404 when the demo organization does not exist", async () => {
    mockGetDemoOrganization.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("ORGANIZATION_NOT_FOUND");
  });
});
