import "server-only";

import Decimal from "decimal.js";
import { format } from "date-fns";

import { db } from "@/lib/db";
import { microsToUsdDecimal } from "@/lib/db/costs";
import {
  getDefaultUsageDateRange,
  type UsageDateRange,
} from "@/lib/analytics/usage";

export type ProfitabilityStatus =
  | "Healthy"
  | "Watch"
  | "Pricing Risk"
  | "No Revenue Data";

export interface ClientProfitabilityRow {
  clientId: string;
  clientName: string;
  projectNames: string[];
  revenueUsd: number | null;
  aiSpendUsd: number;
  estimatedLaborCostUsd: number;
  aiCostRatio: number | null;
  aiAdjustedMargin: number | null;
  status: ProfitabilityStatus;
  requestCount: number;
  totalTokens: number;
}

export interface CalculateClientProfitabilityInput {
  clientId: string;
  clientName: string;
  projectNames?: readonly string[];
  revenueUsd?: number | null;
  aiSpendUsd?: number | null;
  estimatedLaborCostUsd?: number | null;
  requestCount?: number | null;
  totalTokens?: number | null;
}

interface ProfitabilityStatusInput {
  revenueUsd: number | null;
  aiCostRatio: number | null;
}

export function getRevenueMonthForDateRange(dateRange: UsageDateRange): string {
  return format(dateRange.from, "yyyy-MM");
}

export function getProfitabilityStatus({
  revenueUsd,
  aiCostRatio,
}: ProfitabilityStatusInput): ProfitabilityStatus {
  if (revenueUsd == null || revenueUsd <= 0 || aiCostRatio == null) {
    return "No Revenue Data";
  }

  if (aiCostRatio >= 0.15) {
    return "Pricing Risk";
  }

  if (aiCostRatio >= 0.05) {
    return "Watch";
  }

  return "Healthy";
}

function assertNonNegative(label: string, value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }

  if (value < 0) {
    throw new Error(`${label} cannot be negative`);
  }

  return value;
}

function nullableRevenue(value: number | null | undefined): number | null {
  if (value == null) {
    return null;
  }

  return assertNonNegative("revenueUsd", value);
}

function safeCount(value: number | null | undefined): number {
  if (value == null) {
    return 0;
  }

  return Math.max(0, value);
}

export function calculateClientProfitability(
  input: CalculateClientProfitabilityInput,
): ClientProfitabilityRow {
  const revenueUsd = nullableRevenue(input.revenueUsd);
  const aiSpendUsd = assertNonNegative("aiSpendUsd", input.aiSpendUsd ?? 0);
  const estimatedLaborCostUsd = assertNonNegative(
    "estimatedLaborCostUsd",
    input.estimatedLaborCostUsd ?? 0,
  );

  const hasRevenue = revenueUsd != null && revenueUsd > 0;
  const aiCostRatio = hasRevenue ? aiSpendUsd / revenueUsd : null;
  const aiAdjustedMargin = hasRevenue
    ? (revenueUsd - aiSpendUsd - estimatedLaborCostUsd) / revenueUsd
    : null;

  return {
    clientId: input.clientId,
    clientName: input.clientName,
    projectNames: [...(input.projectNames ?? [])],
    revenueUsd,
    aiSpendUsd,
    estimatedLaborCostUsd,
    aiCostRatio,
    aiAdjustedMargin,
    status: getProfitabilityStatus({ revenueUsd, aiCostRatio }),
    requestCount: safeCount(input.requestCount),
    totalTokens: safeCount(input.totalTokens),
  };
}

function decimalToNumber(value: Decimal.Value | null | undefined): number | null {
  if (value == null) {
    return null;
  }

  return new Decimal(value).toNumber();
}

function microsToUsd(value: bigint | null | undefined): number {
  if (value == null) {
    return 0;
  }

  return microsToUsdDecimal(value).toNumber();
}

export async function getClientProfitabilityRows(
  organizationId: string,
  dateRange: UsageDateRange = getDefaultUsageDateRange(),
): Promise<ClientProfitabilityRow[]> {
  const revenueMonth = getRevenueMonthForDateRange(dateRange);

  const [clients, usageByClient, revenueRows] = await Promise.all([
    db.client.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        projects: {
          select: { name: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.aiUsageEvent.groupBy({
      by: ["clientId"],
      where: {
        organizationId,
        clientId: { not: null },
        occurredAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
      },
      _count: { _all: true },
      _sum: {
        totalCostMicros: true,
        totalTokens: true,
      },
      orderBy: { clientId: "asc" },
    }),
    db.clientRevenue.findMany({
      where: {
        organizationId,
        projectId: null,
        month: revenueMonth,
      },
      select: {
        clientId: true,
        revenueUsd: true,
        estimatedLaborCostUsd: true,
      },
    }),
  ]);

  const usageByClientId = new Map(
    usageByClient
      .filter((row) => row.clientId != null)
      .map((row) => [
        row.clientId,
        {
          aiSpendUsd: microsToUsd(row._sum.totalCostMicros),
          requestCount: row._count._all,
          totalTokens: row._sum.totalTokens ?? 0,
        },
      ]),
  );

  const revenueByClientId = new Map(
    revenueRows.map((row) => [
      row.clientId,
      {
        revenueUsd: decimalToNumber(row.revenueUsd),
        estimatedLaborCostUsd: decimalToNumber(row.estimatedLaborCostUsd),
      },
    ]),
  );

  return clients.map((client) => {
    const usage = usageByClientId.get(client.id);
    const revenue = revenueByClientId.get(client.id);

    return calculateClientProfitability({
      clientId: client.id,
      clientName: client.name,
      projectNames: client.projects.map((project) => project.name),
      revenueUsd: revenue?.revenueUsd ?? null,
      aiSpendUsd: usage?.aiSpendUsd ?? 0,
      estimatedLaborCostUsd: revenue?.estimatedLaborCostUsd ?? 0,
      requestCount: usage?.requestCount ?? 0,
      totalTokens: usage?.totalTokens ?? 0,
    });
  });
}
