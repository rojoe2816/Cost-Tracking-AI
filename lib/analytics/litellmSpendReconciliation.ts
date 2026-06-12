import "server-only";

import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";
import type { LiteLlmUsage } from "@/lib/litellm/client";

type LiteLlmSpendRow = {
  requestId: string | null;
  spend: unknown;
  model: string | null;
  provider: string | null;
  promptTokens: unknown;
  completionTokens: unknown;
  totalTokens: unknown;
};

export type LiteLlmSpendReconciliation = {
  externalLiteLlmRequestId?: string;
  provider?: string;
  model?: string;
  usage?: LiteLlmUsage;
  costUsd?: number;
};

const RECONCILIATION_QUERY = `
  SELECT
    request_id AS "requestId",
    spend,
    model,
    custom_llm_provider AS provider,
    prompt_tokens AS "promptTokens",
    completion_tokens AS "completionTokens",
    total_tokens AS "totalTokens"
  FROM "LiteLLM_SpendLogs"
  WHERE ($1 <> '' AND request_id = $1)
     OR request_tags ? $2
     OR COALESCE(metadata->>'app_request_id', '') = $3
  ORDER BY "startTime" DESC
  LIMIT 1
`;

const RECONCILIATION_ATTEMPTS = 25;
const RECONCILIATION_DELAY_MS = 250;

const globalForLiteLlmAnalytics = globalThis as typeof globalThis & {
  liteLlmAnalyticsDb?: PrismaClient;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    const converted = Number(value);
    return Number.isFinite(converted) ? converted : undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    const converted = Number(trimmed);
    return Number.isFinite(converted) ? converted : undefined;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toString" in value &&
    typeof value.toString === "function"
  ) {
    const converted = Number(value.toString());
    return Number.isFinite(converted) ? converted : undefined;
  }

  return undefined;
}

function getLiteLlmAnalyticsDb() {
  if (!env.LITELLM_ANALYTICS_DATABASE_URL) {
    return null;
  }

  if (!globalForLiteLlmAnalytics.liteLlmAnalyticsDb) {
    globalForLiteLlmAnalytics.liteLlmAnalyticsDb = new PrismaClient({
      datasourceUrl: env.LITELLM_ANALYTICS_DATABASE_URL,
      log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  return globalForLiteLlmAnalytics.liteLlmAnalyticsDb;
}

function mapSpendRow(row: LiteLlmSpendRow): LiteLlmSpendReconciliation {
  const externalLiteLlmRequestId = toOptionalString(row.requestId);
  const provider = toOptionalString(row.provider);
  const model = toOptionalString(row.model);
  const costUsd = toOptionalNumber(row.spend);
  const inputTokens = toOptionalNumber(row.promptTokens);
  const outputTokens = toOptionalNumber(row.completionTokens);
  const totalTokens =
    toOptionalNumber(row.totalTokens) ??
    (inputTokens !== undefined || outputTokens !== undefined
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : undefined);

  return {
    ...(externalLiteLlmRequestId ? { externalLiteLlmRequestId } : {}),
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    ...(inputTokens !== undefined ||
    outputTokens !== undefined ||
    totalTokens !== undefined
      ? {
          usage: {
            ...(inputTokens !== undefined ? { inputTokens } : {}),
            ...(outputTokens !== undefined ? { outputTokens } : {}),
            ...(totalTokens !== undefined ? { totalTokens } : {}),
          },
        }
      : {}),
    ...(costUsd !== undefined ? { costUsd } : {}),
  };
}

export function isLiteLlmAnalyticsConfigured() {
  return Boolean(env.LITELLM_ANALYTICS_DATABASE_URL);
}

export async function reconcileLiteLlmSpendByAppRequestId(
  appRequestId: string,
  externalLiteLlmRequestId?: string,
): Promise<LiteLlmSpendReconciliation | null> {
  const analyticsDb = getLiteLlmAnalyticsDb();

  if (!analyticsDb) {
    return null;
  }

  const tag = `app_request:${appRequestId}`;

  for (let attempt = 0; attempt < RECONCILIATION_ATTEMPTS; attempt += 1) {
    const [row] = await analyticsDb.$queryRawUnsafe<LiteLlmSpendRow[]>(
      RECONCILIATION_QUERY,
      externalLiteLlmRequestId ?? "",
      tag,
      appRequestId,
    );

    if (row) {
      return mapSpendRow(row);
    }

    if (attempt < RECONCILIATION_ATTEMPTS - 1) {
      await sleep(RECONCILIATION_DELAY_MS);
    }
  }

  return null;
}
