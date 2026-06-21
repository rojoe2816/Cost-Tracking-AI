import "server-only";

import {
  isLiteLlmAnalyticsConfigured,
  reconcileLiteLlmSpendByAppRequestId,
  type LiteLlmSpendReconciliation,
} from "@/lib/analytics/litellmSpendReconciliation";
import type {
  LiteLlmCompletionResult,
  LiteLlmUsage,
} from "@/lib/litellm/client";
import { logger } from "@/lib/logger";

export type ResolvedLiteLlmCompletion = {
  content: string;
  provider: string;
  model: string;
  usage: Required<LiteLlmUsage>;
  costUsd?: number;
  externalLiteLlmRequestId?: string;
};

function completionNeedsReconciliation(completion: LiteLlmCompletionResult) {
  return (
    !completion.externalLiteLlmRequestId ||
    !completion.provider ||
    completion.costUsd === undefined ||
    completion.usage?.inputTokens === undefined ||
    completion.usage?.outputTokens === undefined ||
    completion.usage?.totalTokens === undefined
  );
}

function mergeUsage(
  directUsage?: LiteLlmUsage,
  reconciledUsage?: LiteLlmUsage,
): Required<LiteLlmUsage> {
  const inputTokens = directUsage?.inputTokens ?? reconciledUsage?.inputTokens ?? 0;
  const outputTokens =
    directUsage?.outputTokens ?? reconciledUsage?.outputTokens ?? 0;
  const totalTokens =
    directUsage?.totalTokens ??
    reconciledUsage?.totalTokens ??
    inputTokens + outputTokens;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

function mergeCompletion(
  completion: LiteLlmCompletionResult,
  reconciliation: LiteLlmSpendReconciliation | null,
): ResolvedLiteLlmCompletion {
  return {
    content: completion.content,
    provider: completion.provider ?? reconciliation?.provider ?? "unknown",
    model: completion.model || reconciliation?.model || "unknown",
    usage: mergeUsage(completion.usage, reconciliation?.usage),
    ...(completion.costUsd !== undefined
      ? { costUsd: completion.costUsd }
      : reconciliation?.costUsd !== undefined
        ? { costUsd: reconciliation.costUsd }
        : {}),
    ...(completion.externalLiteLlmRequestId
      ? { externalLiteLlmRequestId: completion.externalLiteLlmRequestId }
      : reconciliation?.externalLiteLlmRequestId
        ? {
            externalLiteLlmRequestId: reconciliation.externalLiteLlmRequestId,
          }
        : {}),
  };
}

export async function resolveLiteLlmCompletionForPersistence(input: {
  aiRequestAuditId: string;
  completion: LiteLlmCompletionResult;
  organizationId: string;
}): Promise<ResolvedLiteLlmCompletion> {
  let reconciliation: LiteLlmSpendReconciliation | null = null;

  if (completionNeedsReconciliation(input.completion)) {
    if (!isLiteLlmAnalyticsConfigured()) {
      logger.warn(
        {
          aiRequestAuditId: input.aiRequestAuditId,
          organizationId: input.organizationId,
          missingExternalLiteLlmRequestId: !input.completion.externalLiteLlmRequestId,
          missingProvider: !input.completion.provider,
          missingCostUsd: input.completion.costUsd === undefined,
        },
        "LiteLLM analytics reconciliation skipped because no analytics database is configured",
      );
    } else {
      try {
        reconciliation = await reconcileLiteLlmSpendByAppRequestId(
          input.aiRequestAuditId,
          input.completion.externalLiteLlmRequestId,
        );
      } catch (error) {
        logger.warn(
          {
            err: error,
            aiRequestAuditId: input.aiRequestAuditId,
            organizationId: input.organizationId,
          },
          "LiteLLM spend reconciliation failed",
        );
      }
    }
  }

  const resolvedCompletion = mergeCompletion(input.completion, reconciliation);

  if (
    !resolvedCompletion.externalLiteLlmRequestId ||
    resolvedCompletion.provider === "unknown" ||
    resolvedCompletion.costUsd === undefined
  ) {
    logger.warn(
      {
        aiRequestAuditId: input.aiRequestAuditId,
        organizationId: input.organizationId,
        hasExternalLiteLlmRequestId: Boolean(
          resolvedCompletion.externalLiteLlmRequestId,
        ),
        provider: resolvedCompletion.provider,
        hasCostUsd: resolvedCompletion.costUsd !== undefined,
      },
      "LiteLLM completion metadata remained incomplete after reconciliation",
    );
  }

  return resolvedCompletion;
}
