import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { microsToUsdDecimal } from "@/lib/db/costs";

import type { UsageDateRange } from "./usage";
import { getDefaultUsageDateRange } from "./usage";

export interface InternalUsageAggregateRow {
  id: string | null;
  label: string;
  requests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  spendUsd: number;
  avgCostPerRequest: number;
  latestUsageAt: Date | null;
}

export interface RecentInternalAiUsageRow {
  id: string;
  createdAt: Date;
  employeeName: string | null;
  sourceAppName: string | null;
  clientName: string | null;
  projectName: string | null;
  workflowName: string | null;
  taskType: string | null;
  model: string;
  provider: string;
  totalTokens: number;
  spendUsd: number;
  externalLiteLlmRequestId: string | null;
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

function averageCost(totalSpendUsd: number, requests: number): number {
  if (requests === 0) {
    return 0;
  }

  return totalSpendUsd / requests;
}

function safeInt(value: number | null | undefined): number {
  return value ?? 0;
}

async function aggregateUsageByField(
  organizationId: string,
  dateRange: UsageDateRange,
  field: "employeeId" | "sourceAppId" | "taskType",
  nullLabel: string,
  lookup: (
    ids: string[],
  ) => Promise<Array<{ id: string; name: string }>>,
): Promise<InternalUsageAggregateRow[]> {
  const grouped = await db.aiUsageEvent.groupBy({
    by: [field],
    where: usageEventWhere(organizationId, dateRange),
    _count: { _all: true },
    _sum: {
      totalCostMicros: true,
      totalTokens: true,
      promptTokens: true,
      completionTokens: true,
    },
    _max: {
      occurredAt: true,
    },
  });

  const ids = grouped
    .map((row) => row[field])
    .filter((id): id is string => id != null);

  const records = ids.length > 0 ? await lookup(ids) : [];
  const labelById = new Map(records.map((record) => [record.id, record.name]));

  return grouped
    .map((row) => {
      const id = row[field];
      const requests = row._count._all;
      const spendUsd = microsToUsd(row._sum.totalCostMicros);

      return {
        id,
        label: id ? (labelById.get(id) ?? "Unknown") : nullLabel,
        requests,
        totalTokens: safeInt(row._sum.totalTokens),
        promptTokens: safeInt(row._sum.promptTokens),
        completionTokens: safeInt(row._sum.completionTokens),
        spendUsd,
        avgCostPerRequest: averageCost(spendUsd, requests),
        latestUsageAt: row._max.occurredAt,
      };
    })
    .sort((left, right) => right.spendUsd - left.spendUsd);
}

export async function getSpendByEmployee(
  organizationId: string,
  dateRange: UsageDateRange = getDefaultUsageDateRange(),
): Promise<InternalUsageAggregateRow[]> {
  return aggregateUsageByField(
    organizationId,
    dateRange,
    "employeeId",
    "Unassigned employee",
    async (ids) =>
      db.employee.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
  );
}

export async function getSpendBySourceApp(
  organizationId: string,
  dateRange: UsageDateRange = getDefaultUsageDateRange(),
): Promise<InternalUsageAggregateRow[]> {
  return aggregateUsageByField(
    organizationId,
    dateRange,
    "sourceAppId",
    "Unknown source",
    async (ids) =>
      db.aiSourceApp.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      }),
  );
}

export async function getSpendByTaskType(
  organizationId: string,
  dateRange: UsageDateRange = getDefaultUsageDateRange(),
): Promise<InternalUsageAggregateRow[]> {
  const grouped = await db.aiUsageEvent.groupBy({
    by: ["taskType"],
    where: usageEventWhere(organizationId, dateRange),
    _count: { _all: true },
    _sum: {
      totalCostMicros: true,
      totalTokens: true,
      promptTokens: true,
      completionTokens: true,
    },
    _max: {
      occurredAt: true,
    },
  });

  return grouped
    .map((row) => {
      const requests = row._count._all;
      const spendUsd = microsToUsd(row._sum.totalCostMicros);

      return {
        id: row.taskType,
        label: row.taskType ?? "Unknown task",
        requests,
        totalTokens: safeInt(row._sum.totalTokens),
        promptTokens: safeInt(row._sum.promptTokens),
        completionTokens: safeInt(row._sum.completionTokens),
        spendUsd,
        avgCostPerRequest: averageCost(spendUsd, requests),
        latestUsageAt: row._max.occurredAt,
      };
    })
    .sort((left, right) => right.spendUsd - left.spendUsd);
}

export async function getRecentInternalAiUsage(
  organizationId: string,
  limit = 10,
): Promise<RecentInternalAiUsageRow[]> {
  const events = await db.aiUsageEvent.findMany({
    where: {
      organizationId,
      OR: [
        { employeeId: { not: null } },
        { sourceAppId: { not: null } },
        { source: "WEB" },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      taskType: true,
      model: true,
      provider: true,
      totalTokens: true,
      totalCostMicros: true,
      externalLiteLlmRequestId: true,
      employee: { select: { name: true } },
      sourceApp: { select: { name: true } },
      client: { select: { name: true } },
      project: { select: { name: true } },
      workflowType: { select: { name: true } },
    },
  });

  return events.map((event) => ({
    id: event.id,
    createdAt: event.createdAt,
    employeeName: event.employee?.name ?? null,
    sourceAppName: event.sourceApp?.name ?? null,
    clientName: event.client?.name ?? null,
    projectName: event.project?.name ?? null,
    workflowName: event.workflowType?.name ?? null,
    taskType: event.taskType,
    model: event.model,
    provider: event.provider,
    totalTokens: event.totalTokens ?? 0,
    spendUsd: microsToUsd(event.totalCostMicros),
    externalLiteLlmRequestId: event.externalLiteLlmRequestId,
  }));
}
