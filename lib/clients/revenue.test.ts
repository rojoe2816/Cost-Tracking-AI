import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTx = vi.hoisted(() => ({
  client: {
    findFirst: vi.fn(),
  },
  clientRevenue: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockDb = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

import {
  clearClientRevenueForOrganization,
  upsertClientRevenueForOrganization,
} from "./revenue";

const BASE_INPUT = {
  organizationId: "org_demo",
  clientId: "client_acme",
  month: "2026-06",
  revenueUsd: "4000",
  estimatedLaborCostUsd: "1200",
};

describe("upsertClientRevenueForOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation((callback) => callback(mockTx));
    mockTx.client.findFirst.mockResolvedValue({ id: "client_acme" });
    mockTx.clientRevenue.findFirst.mockResolvedValue(null);
    mockTx.clientRevenue.create.mockResolvedValue({ id: "revenue_1" });
    mockTx.clientRevenue.update.mockResolvedValue({ id: "revenue_1" });
  });

  it("updates an existing ClientRevenue row without creating a duplicate", async () => {
    mockTx.clientRevenue.findFirst.mockResolvedValue({ id: "revenue_existing" });

    const result = await upsertClientRevenueForOrganization(BASE_INPUT);

    expect(result).toBe("updated");
    expect(mockTx.clientRevenue.update).toHaveBeenCalledWith({
      where: { id: "revenue_existing" },
      data: {
        revenueUsd: "4000.00",
        estimatedLaborCostUsd: "1200.00",
      },
    });
    expect(mockTx.clientRevenue.create).not.toHaveBeenCalled();
  });

  it("creates a new ClientRevenue row for a new month", async () => {
    const result = await upsertClientRevenueForOrganization({
      ...BASE_INPUT,
      month: "2026-07",
      estimatedLaborCostUsd: "",
    });

    expect(result).toBe("created");
    expect(mockTx.clientRevenue.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org_demo",
        clientId: "client_acme",
        projectId: null,
        month: "2026-07",
        revenueUsd: "4000.00",
        estimatedLaborCostUsd: null,
      },
    });
  });

  it("rejects invalid month values before writing", async () => {
    await expect(
      upsertClientRevenueForOrganization({
        ...BASE_INPUT,
        month: "2026-13",
      }),
    ).rejects.toMatchObject({
      code: "invalid-month",
    });

    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects negative revenue before writing", async () => {
    await expect(
      upsertClientRevenueForOrganization({
        ...BASE_INPUT,
        revenueUsd: "-1",
      }),
    ).rejects.toMatchObject({
      code: "negative-revenue",
    });

    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects negative labor before writing", async () => {
    await expect(
      upsertClientRevenueForOrganization({
        ...BASE_INPUT,
        estimatedLaborCostUsd: "-1",
      }),
    ).rejects.toMatchObject({
      code: "negative-labor",
    });

    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("rejects cross-org client updates", async () => {
    mockTx.client.findFirst.mockResolvedValue(null);

    await expect(
      upsertClientRevenueForOrganization(BASE_INPUT),
    ).rejects.toMatchObject({
      code: "client-not-found",
    });

    expect(mockTx.clientRevenue.create).not.toHaveBeenCalled();
    expect(mockTx.clientRevenue.update).not.toHaveBeenCalled();
  });
});

describe("clearClientRevenueForOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockImplementation((callback) => callback(mockTx));
    mockTx.client.findFirst.mockResolvedValue({ id: "client_acme" });
    mockTx.clientRevenue.findFirst.mockResolvedValue({ id: "revenue_existing" });
    mockTx.clientRevenue.delete.mockResolvedValue({ id: "revenue_existing" });
  });

  it("deletes the org-owned client revenue row for a month", async () => {
    const result = await clearClientRevenueForOrganization({
      organizationId: "org_demo",
      clientId: "client_acme",
      month: "2026-06",
    });

    expect(result).toBe("cleared");
    expect(mockTx.clientRevenue.delete).toHaveBeenCalledWith({
      where: { id: "revenue_existing" },
    });
  });
});
