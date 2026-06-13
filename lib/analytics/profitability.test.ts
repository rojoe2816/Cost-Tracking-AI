import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  client: {
    findMany: vi.fn(),
  },
  aiUsageEvent: {
    groupBy: vi.fn(),
  },
  clientRevenue: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

import {
  calculateClientProfitability,
  getClientRevenueHistoryRows,
  getClientProfitabilityRows,
  getProfitabilityStatus,
  getRevenueMonthForDateRange,
  getUsageDateRangeForRevenueMonth,
} from "./profitability";

const BASE_CLIENT = {
  clientId: "client_acme",
  clientName: "Acme Dental",
};

const DATE_RANGE = {
  from: new Date(2026, 5, 1),
  to: new Date(2026, 5, 30, 23, 59, 59, 999),
};

describe("calculateClientProfitability", () => {
  it("marks exactly 5% AI cost ratio as Watch", () => {
    const row = calculateClientProfitability({
      ...BASE_CLIENT,
      revenueUsd: 4000,
      aiSpendUsd: 200,
      estimatedLaborCostUsd: 1200,
    });

    expect(row.aiCostRatio).toBeCloseTo(0.05, 6);
    expect(row.aiAdjustedMargin).toBeCloseTo(0.65, 6);
    expect(row.status).toBe("Watch");
  });

  it("marks high AI cost ratio as Pricing Risk", () => {
    const row = calculateClientProfitability({
      ...BASE_CLIENT,
      revenueUsd: 900,
      aiSpendUsd: 318,
      estimatedLaborCostUsd: 260,
    });

    expect(row.aiCostRatio).toBeCloseTo(0.3533, 4);
    expect(row.aiAdjustedMargin).toBeCloseTo(0.3578, 4);
    expect(row.status).toBe("Pricing Risk");
  });

  it("returns No Revenue Data when revenue is missing", () => {
    const row = calculateClientProfitability({
      ...BASE_CLIENT,
      aiSpendUsd: 25,
      estimatedLaborCostUsd: 100,
    });

    expect(row.aiCostRatio).toBeNull();
    expect(row.aiAdjustedMargin).toBeNull();
    expect(row.status).toBe("No Revenue Data");
  });

  it("avoids division by zero when revenue is zero", () => {
    const row = calculateClientProfitability({
      ...BASE_CLIENT,
      revenueUsd: 0,
      aiSpendUsd: 25,
      estimatedLaborCostUsd: 100,
    });

    expect(row.aiCostRatio).toBeNull();
    expect(row.aiAdjustedMargin).toBeNull();
    expect(row.status).toBe("No Revenue Data");
  });

  it("keeps exactly 15% AI cost ratio in Pricing Risk", () => {
    expect(
      getProfitabilityStatus({
        revenueUsd: 1000,
        aiCostRatio: 0.15,
      }),
    ).toBe("Pricing Risk");
  });

  it("marks zero AI spend with revenue as Healthy", () => {
    const row = calculateClientProfitability({
      ...BASE_CLIENT,
      revenueUsd: 1000,
      aiSpendUsd: 0,
      estimatedLaborCostUsd: 300,
    });

    expect(row.aiCostRatio).toBe(0);
    expect(row.status).toBe("Healthy");
  });

  it("treats missing labor as zero", () => {
    const row = calculateClientProfitability({
      ...BASE_CLIENT,
      revenueUsd: 1000,
      aiSpendUsd: 50,
    });

    expect(row.estimatedLaborCostUsd).toBe(0);
    expect(row.aiAdjustedMargin).toBeCloseTo(0.95, 6);
  });

  it("rejects negative revenue and labor values", () => {
    expect(() =>
      calculateClientProfitability({
        ...BASE_CLIENT,
        revenueUsd: -1,
        aiSpendUsd: 0,
      }),
    ).toThrow("revenueUsd cannot be negative");

    expect(() =>
      calculateClientProfitability({
        ...BASE_CLIENT,
        revenueUsd: 1000,
        aiSpendUsd: 0,
        estimatedLaborCostUsd: -1,
      }),
    ).toThrow("estimatedLaborCostUsd cannot be negative");
  });
});

describe("getRevenueMonthForDateRange", () => {
  it("uses the date range start month for client-level revenue", () => {
    expect(getRevenueMonthForDateRange(DATE_RANGE)).toBe("2026-06");
  });
});

describe("getUsageDateRangeForRevenueMonth", () => {
  it("builds a local date range for the selected revenue month", () => {
    const dateRange = getUsageDateRangeForRevenueMonth("2026-07");

    expect(dateRange.from).toEqual(new Date(2026, 6, 1));
    expect(dateRange.to).toEqual(new Date(2026, 6, 31, 23, 59, 59, 999));
  });
});

describe("getClientProfitabilityRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all organization clients with selected-month revenue prefill values", async () => {
    mockDb.client.findMany.mockResolvedValue([
      {
        id: "client_acme",
        name: "Acme Dental",
        projects: [{ name: "SEO Retainer" }],
      },
      {
        id: "client_greenline",
        name: "Greenline Roofing",
        projects: [],
      },
    ]);
    mockDb.aiUsageEvent.groupBy.mockResolvedValue([
      {
        clientId: "client_acme",
        _count: { _all: 2 },
        _sum: {
          totalCostMicros: 5_000_000n,
          totalTokens: 1500,
        },
      },
    ]);
    mockDb.clientRevenue.findMany.mockResolvedValue([
      {
        clientId: "client_acme",
        revenueUsd: new Decimal(4000),
        estimatedLaborCostUsd: new Decimal(1200),
      },
    ]);

    const rows = await getClientProfitabilityRows("org_demo", DATE_RANGE);

    expect(rows).toEqual([
      expect.objectContaining({
        clientId: "client_acme",
        clientName: "Acme Dental",
        projectNames: ["SEO Retainer"],
        revenueUsd: 4000,
        aiSpendUsd: 5,
        estimatedLaborCostUsd: 1200,
        requestCount: 2,
        totalTokens: 1500,
        status: "Healthy",
      }),
      expect.objectContaining({
        clientId: "client_greenline",
        clientName: "Greenline Roofing",
        revenueUsd: null,
        aiSpendUsd: 0,
        estimatedLaborCostUsd: 0,
        requestCount: 0,
        totalTokens: 0,
        status: "No Revenue Data",
      }),
    ]);

    expect(mockDb.aiUsageEvent.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["clientId"],
        where: {
          organizationId: "org_demo",
          clientId: { not: null },
          occurredAt: {
            gte: DATE_RANGE.from,
            lte: DATE_RANGE.to,
          },
        },
      }),
    );
    expect(mockDb.clientRevenue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org_demo",
          projectId: null,
          month: "2026-06",
        },
      }),
    );

    const revenueSelect = mockDb.clientRevenue.findMany.mock.calls[0]?.[0]?.select;
    expect(revenueSelect).toBeDefined();
    expect(revenueSelect).not.toHaveProperty("promptText");
    expect(revenueSelect).not.toHaveProperty("responseText");
  });
});

describe("getClientRevenueHistoryRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the latest client revenue rows in updated order without prompt data", async () => {
    const updatedAt = new Date("2026-06-12T12:00:00.000Z");

    mockDb.clientRevenue.findMany.mockResolvedValue([
      {
        id: "revenue_1",
        clientId: "client_acme",
        month: "2026-06",
        revenueUsd: new Decimal(4000),
        estimatedLaborCostUsd: new Decimal(1200),
        updatedAt,
        client: { name: "Acme Dental" },
      },
    ]);

    const rows = await getClientRevenueHistoryRows("org_demo", 6);

    expect(rows).toEqual([
      {
        id: "revenue_1",
        clientId: "client_acme",
        clientName: "Acme Dental",
        month: "2026-06",
        revenueUsd: 4000,
        estimatedLaborCostUsd: 1200,
        updatedAt,
      },
    ]);
    expect(mockDb.clientRevenue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org_demo",
          projectId: null,
        },
        orderBy: [{ updatedAt: "desc" }, { month: "desc" }],
        take: 6,
      }),
    );

    const select = mockDb.clientRevenue.findMany.mock.calls[0]?.[0]?.select;
    expect(select).toBeDefined();
    expect(select).not.toHaveProperty("promptText");
    expect(select).not.toHaveProperty("responseText");
  });
});
