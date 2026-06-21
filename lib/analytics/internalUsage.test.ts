import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  aiUsageEvent: {
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  employee: {
    findMany: vi.fn(),
  },
  aiSourceApp: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

import {
  getRecentInternalAiUsage,
  getSpendByEmployee,
  getSpendBySourceApp,
  getSpendByTaskType,
} from "./internalUsage";

const ORG_ID = "org_demo";
const DATE_RANGE = {
  from: new Date("2026-06-01T00:00:00.000Z"),
  to: new Date("2026-06-30T23:59:59.999Z"),
};

describe("internal usage analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups spend by employee", async () => {
    mockDb.aiUsageEvent.groupBy.mockResolvedValue([
      {
        employeeId: "emp_1",
        _count: { _all: 2 },
        _sum: {
          totalCostMicros: 50n,
          totalTokens: 100,
          promptTokens: 70,
          completionTokens: 30,
        },
        _max: { occurredAt: new Date("2026-06-10T12:00:00.000Z") },
      },
    ]);
    mockDb.employee.findMany.mockResolvedValue([{ id: "emp_1", name: "Tucker Hawkins" }]);

    const rows = await getSpendByEmployee(ORG_ID, DATE_RANGE);

    expect(rows).toEqual([
      expect.objectContaining({
        id: "emp_1",
        label: "Tucker Hawkins",
        requests: 2,
        spendUsd: expect.closeTo(0.00005, 8),
        avgCostPerRequest: expect.closeTo(0.000025, 8),
      }),
    ]);
  });

  it("labels null employee as Unassigned employee", async () => {
    mockDb.aiUsageEvent.groupBy.mockResolvedValue([
      {
        employeeId: null,
        _count: { _all: 1 },
        _sum: {
          totalCostMicros: 10n,
          totalTokens: 20,
          promptTokens: 15,
          completionTokens: 5,
        },
        _max: { occurredAt: null },
      },
    ]);
    mockDb.employee.findMany.mockResolvedValue([]);

    const rows = await getSpendByEmployee(ORG_ID, DATE_RANGE);

    expect(rows[0]?.label).toBe("Unassigned employee");
  });

  it("groups spend by source app", async () => {
    mockDb.aiUsageEvent.groupBy.mockResolvedValue([
      {
        sourceAppId: "app_1",
        _count: { _all: 1 },
        _sum: {
          totalCostMicros: 20n,
          totalTokens: 30,
          promptTokens: 20,
          completionTokens: 10,
        },
        _max: { occurredAt: new Date("2026-06-11T12:00:00.000Z") },
      },
    ]);
    mockDb.aiSourceApp.findMany.mockResolvedValue([
      { id: "app_1", name: "Mock Company AI Portal" },
    ]);

    const rows = await getSpendBySourceApp(ORG_ID, DATE_RANGE);

    expect(rows[0]?.label).toBe("Mock Company AI Portal");
  });

  it("labels null source app as Unknown source", async () => {
    mockDb.aiUsageEvent.groupBy.mockResolvedValue([
      {
        sourceAppId: null,
        _count: { _all: 1 },
        _sum: {
          totalCostMicros: 5n,
          totalTokens: 10,
          promptTokens: 8,
          completionTokens: 2,
        },
        _max: { occurredAt: null },
      },
    ]);
    mockDb.aiSourceApp.findMany.mockResolvedValue([]);

    const rows = await getSpendBySourceApp(ORG_ID, DATE_RANGE);

    expect(rows[0]?.label).toBe("Unknown source");
  });

  it("groups spend by task type", async () => {
    mockDb.aiUsageEvent.groupBy.mockResolvedValue([
      {
        taskType: "client update",
        _count: { _all: 3 },
        _sum: {
          totalCostMicros: 30n,
          totalTokens: 60,
          promptTokens: 40,
          completionTokens: 20,
        },
        _max: { occurredAt: new Date("2026-06-12T12:00:00.000Z") },
      },
    ]);

    const rows = await getSpendByTaskType(ORG_ID, DATE_RANGE);

    expect(rows[0]?.label).toBe("client update");
  });

  it("labels null task type as Unknown task", async () => {
    mockDb.aiUsageEvent.groupBy.mockResolvedValue([
      {
        taskType: null,
        _count: { _all: 1 },
        _sum: {
          totalCostMicros: 1n,
          totalTokens: 2,
          promptTokens: 1,
          completionTokens: 1,
        },
        _max: { occurredAt: null },
      },
    ]);

    const rows = await getSpendByTaskType(ORG_ID, DATE_RANGE);

    expect(rows[0]?.label).toBe("Unknown task");
  });

  it("returns zero average cost when there are no requests", async () => {
    mockDb.aiUsageEvent.groupBy.mockResolvedValue([]);

    const rows = await getSpendByEmployee(ORG_ID, DATE_RANGE);

    expect(rows).toEqual([]);
  });

  it("filters by the provided date range", async () => {
    mockDb.aiUsageEvent.groupBy.mockResolvedValue([]);

    await getSpendByEmployee(ORG_ID, DATE_RANGE);

    expect(mockDb.aiUsageEvent.groupBy.mock.calls[0]?.[0]?.where).toMatchObject({
      organizationId: ORG_ID,
      occurredAt: {
        gte: DATE_RANGE.from,
        lte: DATE_RANGE.to,
      },
    });
  });

  it("returns recent internal usage without prompt or response text", async () => {
    mockDb.aiUsageEvent.findMany.mockResolvedValue([
      {
        id: "usage_1",
        createdAt: new Date("2026-06-12T12:00:00.000Z"),
        taskType: "client update",
        model: "gpt-4o-mini",
        provider: "openai",
        totalTokens: 42,
        totalCostMicros: 12n,
        externalLiteLlmRequestId: "req_abc123456789",
        employee: { name: "Tucker Hawkins" },
        sourceApp: { name: "Mock Company AI Portal" },
        client: { name: "Acme Dental" },
        project: { name: "SEO Retainer" },
        workflowType: { name: "Client Update" },
      },
    ]);

    const rows = await getRecentInternalAiUsage(ORG_ID, 5);
    const serialized = JSON.stringify(rows);

    expect(rows[0]).toMatchObject({
      employeeName: "Tucker Hawkins",
      sourceAppName: "Mock Company AI Portal",
      taskType: "client update",
    });
    expect(serialized).not.toContain("promptText");
    expect(serialized).not.toContain("responseText");
  });
});
