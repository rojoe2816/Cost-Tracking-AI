import "server-only";

import { endOfMonth, startOfMonth } from "date-fns";
import type { AiRequestSource, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { microsToUsdDecimal } from "@/lib/db/costs";

export interface UsageDateRange {
  from: Date;
  to: Date;
}

export interface DashboardUsageSummary {
  totalSpendUsd: number;
  requests: number;
  avgCostPerRequest: number;
  unattributedSpendUsd: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
}

export interface SpendByClientRow {
  clientId: string | null;
  clientName: string;
  spendUsd: number;
  requests: number;
}

export interface SpendByWorkflowRow {
  workflowTypeId: string | null;
  workflowName: string;
  spendUsd: number;
  requests: number;
}

export interface SpendBySourceRow {
  source: AiRequestSource;
  spendUsd: number;
  requests: number;
}

export interface RecentAiRequestRow {
  id: string;
  createdAt: Date;
  source: AiRequestSource;
  clientName: string | null;
  projectName: string | null;
  workflowName: string | null;
  model: string;
  provider: string;
  totalTokens: number;
  spendUsd: number;
  externalLiteLlmRequestId: string | null;
}

export function getDefaultUsageDateRange(now = new Date()): UsageDateRange {
  return {
    from: startOfMonth(now),
    to: endOfMonth(now),
  };
}

function usageEventWhere(
  organizationId: string,
  dateRange: UsageDateRange,
): Prisma.AiUsageEventWhereInput {
  return {
    organizationId,
    occurredAt: {
      gte: dateRange.from,
      lte: dateRange.to,
    },
  };
}

function microsToUsd(value: bigint | null | undefined): number {
  if (value == null) {
    return 0;
  }

  return microsToUsdDecimal(value).toNumber();
}

function safeInt(value: number | null | undefined): number {
  return value ?? 0;
}

function averageCost(totalSpendUsd: number, requests: number): number {
  if (requests === 0) {
    return 0;
  }

  return totalSpendUsd / requests;
}

export async function getDashboardUsageSummary(
  organizationId: string,
  dateRange: UsageDateRange = getDefaultUsageDateRange(),
): Promise<DashboardUsageSummary> {
  const where = usageEventWhere(organizationId, dateRange);

  const [aggregate, unattributedAggregate] = await Promise.all([
    db.aiUsageEvent.aggregate({
      where,
      _count: { _all: true },
      _sum: {
        totalCostMicros: true,
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
      },
    }),
    db.aiUsageEvent.aggregate({
      where: {
        ...where,
        OR: [
          { clientId: null },
          { projectId: null },
          { workflowTypeId: null },
        ],
      },
      _sum: {
        totalCostMicros: true,
      },
    }),
  ]);

  const requests = aggregate._count._all;
  const totalSpendUsd = microsToUsd(aggregate._sum.totalCostMicros);

  return {
    totalSpendUsd,
    requests,
    avgCostPerRequest: averageCost(totalSpendUsd, requests),
    unattributedSpendUsd: microsToUsd(unattributedAggregate._sum.totalCostMicros),
    totalTokens: safeInt(aggregate._sum.totalTokens),
    promptTokens: safeInt(aggregate._sum.promptTokens),
    completionTokens: safeInt(aggregate._sum.completionTokens),
  };
}

export async function getSpendByClient(
  organizationId: string,
  dateRange: UsageDateRange = getDefaultUsageDateRange(),
): Promise<SpendByClientRow[]> {
  const grouped = await db.aiUsageEvent.groupBy({
    by: ["clientId"],
    where: usageEventWhere(organizationId, dateRange),
    _count: { _all: true },
    _sum: { totalCostMicros: true },
    orderBy: { clientId: "asc" },
  });

  const clientIds = grouped
    .map((row) => row.clientId)
    .filter((id): id is string => id != null);

  const clients =
    clientIds.length > 0
      ? await db.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true },
        })
      : [];

  const clientNameById = new Map(clients.map((client) => [client.id, client.name]));

  return grouped
    .map((row) => ({
      clientId: row.clientId,
      clientName: row.clientId
        ? (clientNameById.get(row.clientId) ?? "Unknown client")
        : "Unattributed",
      spendUsd: microsToUsd(row._sum.totalCostMicros),
      requests: row._count._all,
    }))
    .sort((left, right) => right.spendUsd - left.spendUsd);
}

export async function getSpendByWorkflow(
  organizationId: string,
  dateRange: UsageDateRange = getDefaultUsageDateRange(),
): Promise<SpendByWorkflowRow[]> {
  const grouped = await db.aiUsageEvent.groupBy({
    by: ["workflowTypeId"],
    where: usageEventWhere(organizationId, dateRange),
    _count: { _all: true },
    _sum: { totalCostMicros: true },
    orderBy: { workflowTypeId: "asc" },
  });

  const workflowTypeIds = grouped
    .map((row) => row.workflowTypeId)
    .filter((id): id is string => id != null);

  const workflowTypes =
    workflowTypeIds.length > 0
      ? await db.workflowType.findMany({
          where: { id: { in: workflowTypeIds } },
          select: { id: true, name: true },
        })
      : [];

  const workflowNameById = new Map(
    workflowTypes.map((workflow) => [workflow.id, workflow.name]),
  );

  return grouped
    .map((row) => ({
      workflowTypeId: row.workflowTypeId,
      workflowName: row.workflowTypeId
        ? (workflowNameById.get(row.workflowTypeId) ?? "Unknown workflow")
        : "Unattributed",
      spendUsd: microsToUsd(row._sum.totalCostMicros),
      requests: row._count._all,
    }))
    .sort((left, right) => right.spendUsd - left.spendUsd);
}

export async function getSpendBySource(
  organizationId: string,
  dateRange: UsageDateRange = getDefaultUsageDateRange(),
): Promise<SpendBySourceRow[]> {
  const grouped = await db.aiUsageEvent.groupBy({
    by: ["source"],
    where: usageEventWhere(organizationId, dateRange),
    _count: { _all: true },
    _sum: { totalCostMicros: true },
    orderBy: { source: "asc" },
  });

  return grouped
    .map((row) => ({
      source: row.source,
      spendUsd: microsToUsd(row._sum.totalCostMicros),
      requests: row._count._all,
    }))
    .sort((left, right) => right.spendUsd - left.spendUsd);
}

export async function getRecentAiRequests(
  organizationId: string,
  limit = 10,
): Promise<RecentAiRequestRow[]> {
  const events = await db.aiUsageEvent.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      source: true,
      model: true,
      provider: true,
      totalTokens: true,
      totalCostMicros: true,
      externalLiteLlmRequestId: true,
      client: { select: { name: true } },
      project: { select: { name: true } },
      workflowType: { select: { name: true } },
    },
  });

  return events.map((event) => ({
    id: event.id,
    createdAt: event.createdAt,
    source: event.source,
    clientName: event.client?.name ?? null,
    projectName: event.project?.name ?? null,
    workflowName: event.workflowType?.name ?? null,
    model: event.model,
    provider: event.provider,
    totalTokens: event.totalTokens ?? 0,
    spendUsd: microsToUsd(event.totalCostMicros),
    externalLiteLlmRequestId: event.externalLiteLlmRequestId,
  }));
}

export function truncateLiteLlmRequestId(
  requestId: string | null | undefined,
  visibleLength = 12,
): string {
  if (!requestId) {
    return "—";
  }

  if (requestId.length <= visibleLength) {
    return requestId;
  }

  return `${requestId.slice(0, visibleLength)}…`;
}
