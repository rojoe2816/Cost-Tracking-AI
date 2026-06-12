import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  aiUsageEvent: {
    aggregate: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  client: {
    findMany: vi.fn(),
  },
  workflowType: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

import { formatSmallUsd } from "@/lib/db/costs";
import {
  getDashboardUsageSummary,
  getRecentAiRequests,
  getSpendByClient,
  getSpendBySource,
  getSpendByWorkflow,
  truncateLiteLlmRequestId,
} from "./usage";

const ORG_ID = "org_demo";
const DATE_RANGE = {
  from: new Date("2026-06-01T00:00:00.000Z"),
  to: new Date("2026-06-30T23:59:59.999Z"),
};

describe("getDashboardUsageSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("converts total spend micros to dollars", async () => {
    mockDb.aiUsageEvent.aggregate
      .mockResolvedValueOnce({
        _count: { _all: 2 },
        _sum: {
          totalCostMicros: 38n,
          totalTokens: 61,
          promptTokens: 52,
          completionTokens: 9,
        },
      })
      .mockResolvedValueOnce({
        _sum: { totalCostMicros: 0n },
      });

    const summary = await getDashboardUsageSummary(ORG_ID, DATE_RANGE);

    expect(summary.totalSpendUsd).toBeCloseTo(0.000038, 8);
    expect(summary.requests).toBe(2);
    expect(summary.totalTokens).toBe(61);
    expect(summary.promptTokens).toBe(52);
    expect(summary.completionTokens).toBe(9);
  });

  it("returns zero average cost when there are no requests", async () => {
    mockDb.aiUsageEvent.aggregate
      .mockResolvedValueOnce({
        _count: { _all: 0 },
        _sum: {
          totalCostMicros: null,
          totalTokens: null,
          promptTokens: null,
          completionTokens: null,
        },
      })
      .mockResolvedValueOnce({
        _sum: { totalCostMicros: null },
      });

    const summary = await getDashboardUsageSummary(ORG_ID, DATE_RANGE);

    expect(summary.requests).toBe(0);
    expect(summary.avgCostPerRequest).toBe(0);
    expect(summary.totalSpendUsd).toBe(0);
    expect(summary.totalTokens).toBe(0);
  });

  it("includes only partially unattributed spend", async () => {
    mockDb.aiUsageEvent.aggregate
      .mockResolvedValueOnce({
        _count: { _all: 2 },
        _sum: {
          totalCostMicros: 50n,
          totalTokens: 100,
          promptTokens: 70,
          completionTokens: 30,
        },
      })
      .mockResolvedValueOnce({
        _sum: { totalCostMicros: 19n },
      });

    const summary = await getDashboardUsageSummary(ORG_ID, DATE_RANGE);

    expect(summary.unattributedSpendUsd).toBeCloseTo(0.000019, 8);

    const unattributedCall = mockDb.aiUsageEvent.aggregate.mock.calls[1]?.[0];
    expect(unattributedCall?.where).toMatchObject({
      organizationId: ORG_ID,
      OR: [
        { clientId: null },
        { projectId: null },
        { workflowTypeId: null },
      ],
    });
  });

  it("filters by the provided date range", async () => {
    mockDb.aiUsageEvent.aggregate
      .mockResolvedValueOnce({
        _count: { _all: 1 },
        _sum: {
          totalCostMicros: 19n,
          totalTokens: 61,
          promptTokens: 52,
          completionTokens: 9,
        },
      })
      .mockResolvedValueOnce({
        _sum: { totalCostMicros: 0n },
      });

    await getDashboardUsageSummary(ORG_ID, DATE_RANGE);

    expect(mockDb.aiUsageEvent.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: ORG_ID,
          occurredAt: {
            gte: DATE_RANGE.from,
            lte: DATE_RANGE.to,
          },
        },
      }),
    );
  });
});

describe("getSpendByClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups spend by client", async () => {
    mockDb.aiUsageEvent.groupBy.mockResolvedValue([
      {
        clientId: "client_acme",
        _count: { _all: 1 },
        _sum: { totalCostMicros: 19n },
      },
      {
        clientId: null,
        _count: { _all: 1 },
        _sum: { totalCostMicros: 5n },
      },
    ]);
    mockDb.client.findMany.mockResolvedValue([
      { id: "client_acme", name: "Acme Dental" },
    ]);

    const rows = await getSpendByClient(ORG_ID, DATE_RANGE);

    expect(rows).toEqual([
      {
        clientId: "client_acme",
        clientName: "Acme Dental",
        spendUsd: 0.000019,
        requests: 1,
      },
      {
        clientId: null,
        clientName: "Unattributed",
        spendUsd: 0.000005,
        requests: 1,
      },
    ]);
  });
});

describe("getSpendByWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups spend by workflow type", async () => {
    mockDb.aiUsageEvent.groupBy.mockResolvedValue([
      {
        workflowTypeId: "workflow_client_update",
        _count: { _all: 1 },
        _sum: { totalCostMicros: 19n },
      },
    ]);
    mockDb.workflowType.findMany.mockResolvedValue([
      { id: "workflow_client_update", name: "Client Update" },
    ]);

    const rows = await getSpendByWorkflow(ORG_ID, DATE_RANGE);

    expect(rows).toEqual([
      {
        workflowTypeId: "workflow_client_update",
        workflowName: "Client Update",
        spendUsd: 0.000019,
        requests: 1,
      },
    ]);
  });
});

describe("getSpendBySource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups spend by Slack vs Web", async () => {
    mockDb.aiUsageEvent.groupBy.mockResolvedValue([
      {
        source: "SLACK",
        _count: { _all: 2 },
        _sum: { totalCostMicros: 24n },
      },
      {
        source: "WEB",
        _count: { _all: 1 },
        _sum: { totalCostMicros: 10n },
      },
    ]);

    const rows = await getSpendBySource(ORG_ID, DATE_RANGE);

    expect(rows).toEqual([
      {
        source: "SLACK",
        spendUsd: 0.000024,
        requests: 2,
      },
      {
        source: "WEB",
        spendUsd: 0.00001,
        requests: 1,
      },
    ]);
  });
});

describe("getRecentAiRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns recent metadata without prompt or response text fields", async () => {
    mockDb.aiUsageEvent.findMany.mockResolvedValue([
      {
        id: "usage_1",
        createdAt: new Date("2026-06-09T12:00:00.000Z"),
        source: "SLACK",
        model: "gpt-4o-mini",
        provider: "openai",
        totalTokens: 61,
        totalCostMicros: 19n,
        externalLiteLlmRequestId: "chatcmpl-abc123456789",
        client: { name: "Acme Dental" },
        project: { name: "SEO Retainer" },
        workflowType: { name: "Client Update" },
      },
    ]);

    const rows = await getRecentAiRequests(ORG_ID, 5);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: "usage_1",
      createdAt: new Date("2026-06-09T12:00:00.000Z"),
      source: "SLACK",
      clientName: "Acme Dental",
      projectName: "SEO Retainer",
      workflowName: "Client Update",
      model: "gpt-4o-mini",
      provider: "openai",
      totalTokens: 61,
      spendUsd: 0.000019,
      externalLiteLlmRequestId: "chatcmpl-abc123456789",
    });

    const select = mockDb.aiUsageEvent.findMany.mock.calls[0]?.[0]?.select;
    expect(select).toBeDefined();
    expect(select).not.toHaveProperty("promptText");
    expect(select).not.toHaveProperty("responseText");
  });

  it("handles null cost and token values safely", async () => {
    mockDb.aiUsageEvent.findMany.mockResolvedValue([
      {
        id: "usage_2",
        createdAt: new Date("2026-06-09T13:00:00.000Z"),
        source: "WEB",
        model: "gpt-4o-mini",
        provider: "openai",
        totalTokens: null,
        totalCostMicros: null,
        externalLiteLlmRequestId: null,
        client: null,
        project: null,
        workflowType: null,
      },
    ]);

    const rows = await getRecentAiRequests(ORG_ID, 5);

    expect(rows[0]?.spendUsd).toBe(0);
    expect(rows[0]?.totalTokens).toBe(0);
    expect(rows[0]?.externalLiteLlmRequestId).toBeNull();
  });
});

describe("formatSmallUsd", () => {
  it("shows tiny spend with extra precision", () => {
    expect(formatSmallUsd(0)).toBe("$0.00");
    expect(formatSmallUsd(0.000019)).toBe("$0.000019");
    expect(formatSmallUsd(0.01)).toBe("$0.01");
    expect(formatSmallUsd(12.34)).toBe("$12.34");
  });
});

describe("truncateLiteLlmRequestId", () => {
  it("truncates long request ids for display", () => {
    expect(truncateLiteLlmRequestId("chatcmpl-abc123456789")).toBe(
      "chatcmpl-abc…",
    );
    expect(truncateLiteLlmRequestId(null)).toBe("—");
  });
});
