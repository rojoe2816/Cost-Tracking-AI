import "server-only";

import {
  createAiUsageEvent,
  createProcessingAiRequestAudit,
  createQueuedAiRequestAudit,
  getAiRequestAuditById,
  markAiRequestCompleted,
  markAiRequestFailed,
  markAiRequestProcessing,
} from "@/lib/ai/requests";
import {
  isLiteLlmAnalyticsConfigured,
  reconcileLiteLlmSpendByAppRequestId,
  type LiteLlmSpendReconciliation,
} from "@/lib/analytics/litellmSpendReconciliation";
import { usdToMicros } from "@/lib/db/costs";
import { db } from "@/lib/db";
import type { SlackAiRequestJobPayload } from "@/lib/queue/types";
import {
  sendLiteLlmChatCompletion,
  type LiteLlmCompletionResult,
  type LiteLlmUsage,
} from "@/lib/litellm/client";
import { logger } from "@/lib/logger";
import {
  resolveSlackAttribution,
  type SlackAttribution,
} from "@/lib/slack/attribution";
import { buildUnmappedChannelAssignmentBlocks } from "@/lib/slack/blocks";
import {
  fetchMessageText,
  postMessage,
  updateMessage,
} from "@/lib/slack/client";

const SLACK_AI_SYSTEM_PROMPT =
  "You are a helpful assistant responding in Slack. Be concise and clear.";

const UNKNOWN_WORKSPACE_MESSAGE =
  "This Slack workspace is not connected to Slate yet. Please connect the workspace before using Slate.";

const FAILURE_MESSAGE =
  "Sorry, I could not complete that AI request. Please try again or contact an admin if this keeps happening.";

const THINKING_MESSAGE = "Thinking...";

const MAX_ERROR_MESSAGE_LENGTH = 1000;

type ResolvedLiteLlmCompletion = {
  content: string;
  provider: string;
  model: string;
  usage: Required<LiteLlmUsage>;
  costUsd?: number;
  externalLiteLlmRequestId?: string;
};

export async function handleSlackAiRequestJob(
  payload: SlackAiRequestJobPayload,
): Promise<void> {
  const text = await resolveSlackRequestText(payload);

  if (!text) {
    logger.warn(
      {
        slackTeamId: payload.slackTeamId,
        slackChannelId: payload.slackChannelId,
        hasMessageTs: Boolean(payload.messageTs),
        hasInlineText: Boolean(payload.text),
        aiRequestAuditId: payload.aiRequestAuditId,
      },
      "Could not resolve Slack request text for background job",
    );
    return;
  }

  const resolvedPayload: SlackAiRequestJobPayload = {
    ...payload,
    text,
  };

  const resolved = await resolveSlackAttribution({
    slackTeamId: resolvedPayload.slackTeamId,
    slackChannelId: resolvedPayload.slackChannelId,
  });

  const attribution = mergePayloadAttribution(resolved, resolvedPayload);

  logger.info(
    {
      organizationId: attribution.organizationId,
      slackTeamId: resolvedPayload.slackTeamId,
      slackChannelId: resolvedPayload.slackChannelId,
      slackUserId: resolvedPayload.slackUserId,
      mappingStatus: attribution.mappingStatus,
      textLength: text.length,
      hasAiRequestAuditId: Boolean(resolvedPayload.aiRequestAuditId),
    },
    "Resolved Slack AI request attribution",
  );

  switch (attribution.mappingStatus) {
    case "UNKNOWN_WORKSPACE":
      await handleUnknownWorkspace(resolvedPayload);
      return;

    case "UNMAPPED":
      await handleUnmappedChannel(resolvedPayload, attribution);
      return;

    case "MAPPED":
      await handleMappedChannel(resolvedPayload, attribution, text);
      return;

    default: {
      const exhaustiveCheck: never = attribution.mappingStatus;
      throw new Error(`Unsupported mapping status: ${exhaustiveCheck}`);
    }
  }
}

async function resolveSlackRequestText(
  payload: SlackAiRequestJobPayload,
): Promise<string | null> {
  const inlineText = payload.text?.trim();

  if (inlineText) {
    return inlineText;
  }

  if (!payload.messageTs) {
    return null;
  }

  const { text } = await fetchMessageText({
    channel: payload.slackChannelId,
    messageTs: payload.messageTs,
    ...(payload.threadTs ? { threadTs: payload.threadTs } : {}),
    slackTeamId: payload.slackTeamId,
  });

  return text?.trim() || null;
}

function mergePayloadAttribution(
  resolved: SlackAttribution,
  payload: SlackAiRequestJobPayload,
): SlackAttribution {
  if (resolved.mappingStatus === "UNKNOWN_WORKSPACE") {
    return resolved;
  }

  const organizationId = resolved.organizationId ?? payload.organizationId ?? null;

  if (payload.aiRequestAuditId) {
    return {
      organizationId,
      clientId: payload.clientId ?? null,
      projectId: payload.projectId ?? null,
      workflowTypeId: payload.workflowTypeId ?? null,
      mappingStatus: "MAPPED",
    };
  }

  if (payload.mappingStatus === "MAPPED" || payload.clientId) {
    return {
      organizationId,
      clientId: payload.clientId ?? resolved.clientId,
      projectId: payload.projectId ?? resolved.projectId,
      workflowTypeId: payload.workflowTypeId ?? resolved.workflowTypeId,
      mappingStatus: "MAPPED",
    };
  }

  return {
    ...resolved,
    organizationId,
  };
}

function threadTs(payload: SlackAiRequestJobPayload): string | undefined {
  return payload.threadTs ?? payload.messageTs;
}

function slackThreadOptions(payload: SlackAiRequestJobPayload) {
  const ts = threadTs(payload);

  return {
    slackTeamId: payload.slackTeamId,
    ...(ts ? { threadTs: ts } : {}),
  };
}

async function handleUnknownWorkspace(
  payload: SlackAiRequestJobPayload,
): Promise<void> {
  await postMessage({
    channel: payload.slackChannelId,
    text: UNKNOWN_WORKSPACE_MESSAGE,
    ...slackThreadOptions(payload),
  });
}

async function handleUnmappedChannel(
  payload: SlackAiRequestJobPayload,
  attribution: SlackAttribution,
): Promise<void> {
  if (!attribution.organizationId) {
    logger.warn(
      {
        slackTeamId: payload.slackTeamId,
        slackChannelId: payload.slackChannelId,
      },
      "Cannot handle unmapped channel without organizationId",
    );
    return;
  }

  const audit = await createQueuedAiRequestAudit({
    organizationId: attribution.organizationId,
    source: "SLACK",
    slackTeamId: payload.slackTeamId,
    slackChannelId: payload.slackChannelId,
    slackUserId: payload.slackUserId,
    ...(payload.threadTs ? { slackThreadTs: payload.threadTs } : {}),
    ...(payload.messageTs ? { slackMessageTs: payload.messageTs } : {}),
  });

  const [clients, projects, workflowTypes] = await Promise.all([
    db.client.findMany({
      where: {
        organizationId: attribution.organizationId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    db.project.findMany({
      where: {
        organizationId: attribution.organizationId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        clientId: true,
        client: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
    db.workflowType.findMany({
      where: {
        organizationId: attribution.organizationId,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  const blocks = buildUnmappedChannelAssignmentBlocks({
    clients,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      clientId: project.clientId,
      clientName: project.client.name,
    })),
    workflowTypes,
    originalRequestId: audit.id,
    slackTeamId: payload.slackTeamId,
    slackChannelId: payload.slackChannelId,
  });

  await postMessage({
    channel: payload.slackChannelId,
    text: "Slate needs attribution before this AI request can be processed.",
    blocks,
    ...slackThreadOptions(payload),
  });
}

async function handleMappedChannel(
  payload: SlackAiRequestJobPayload,
  attribution: SlackAttribution,
  requestText: string,
): Promise<void> {
  if (!attribution.organizationId) {
    logger.warn(
      {
        slackTeamId: payload.slackTeamId,
        slackChannelId: payload.slackChannelId,
      },
      "Cannot process mapped channel without organizationId",
    );
    return;
  }

  let auditId: string;

  if (payload.aiRequestAuditId) {
    const existingAudit = await getAiRequestAuditById(payload.aiRequestAuditId);

    if (existingAudit?.status === "COMPLETED") {
      logger.info(
        {
          aiRequestAuditId: payload.aiRequestAuditId,
          slackTeamId: payload.slackTeamId,
          slackChannelId: payload.slackChannelId,
        },
        "Skipping duplicate Slack AI request for completed audit",
      );
      return;
    }

    auditId = payload.aiRequestAuditId;
    await markAiRequestProcessing(auditId, {
      clientId: attribution.clientId,
      projectId: attribution.projectId,
      workflowTypeId: attribution.workflowTypeId,
    });
  } else {
    const audit = await createProcessingAiRequestAudit({
      organizationId: attribution.organizationId,
      source: "SLACK",
      clientId: attribution.clientId,
      projectId: attribution.projectId,
      workflowTypeId: attribution.workflowTypeId,
      slackTeamId: payload.slackTeamId,
      slackChannelId: payload.slackChannelId,
      slackUserId: payload.slackUserId,
      ...(payload.threadTs ? { slackThreadTs: payload.threadTs } : {}),
      ...(payload.messageTs ? { slackMessageTs: payload.messageTs } : {}),
    });
    auditId = audit.id;
  }

  let thinkingMessageTs: string | undefined;
  const thinkingChannel = payload.slackChannelId;

  try {
    const thinkingMessage = await postMessage({
      channel: payload.slackChannelId,
      text: THINKING_MESSAGE,
      ...slackThreadOptions(payload),
    });

    thinkingMessageTs = thinkingMessage.ts;

    const startedAt = Date.now();
    const completion = await sendLiteLlmChatCompletion({
      messages: [
        {
          role: "system",
          content: SLACK_AI_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: requestText,
        },
      ],
      metadata: {
        organization_id: attribution.organizationId,
        user_id: payload.slackUserId,
        ...(attribution.clientId ? { client_id: attribution.clientId } : {}),
        ...(attribution.projectId ? { project_id: attribution.projectId } : {}),
        ...(attribution.workflowTypeId
          ? { workflow_type_id: attribution.workflowTypeId }
          : {}),
        source: "slack",
        app_request_id: auditId,
      },
    });

    const latencyMs = Date.now() - startedAt;
    const resolvedCompletion = await resolveLiteLlmCompletionForPersistence({
      aiRequestAuditId: auditId,
      completion,
      organizationId: attribution.organizationId,
    });

    await markAiRequestCompleted(
      auditId,
      resolvedCompletion.externalLiteLlmRequestId,
    );

    await createAiUsageEvent({
      organizationId: attribution.organizationId,
      aiRequestAuditId: auditId,
      source: "SLACK",
      provider: resolvedCompletion.provider,
      model: resolvedCompletion.model,
      promptTokens: resolvedCompletion.usage.inputTokens,
      completionTokens: resolvedCompletion.usage.outputTokens,
      totalTokens: resolvedCompletion.usage.totalTokens,
      totalCostMicros:
        resolvedCompletion.costUsd !== undefined
          ? usdToMicros(resolvedCompletion.costUsd)
          : 0n,
      latencyMs,
      ...(resolvedCompletion.externalLiteLlmRequestId
        ? {
            externalLiteLlmRequestId:
              resolvedCompletion.externalLiteLlmRequestId,
          }
        : {}),
      slackTeamId: payload.slackTeamId,
      slackChannelId: payload.slackChannelId,
      ...(payload.threadTs ? { slackThreadTs: payload.threadTs } : {}),
      ...(payload.messageTs ? { slackMessageTs: payload.messageTs } : {}),
      clientId: attribution.clientId,
      projectId: attribution.projectId,
      workflowTypeId: attribution.workflowTypeId,
    });

    await updateMessage({
      channel: thinkingChannel,
      ts: thinkingMessageTs,
      text: completion.content,
    });

    logger.info(
      {
        aiRequestAuditId: auditId,
        organizationId: attribution.organizationId,
        slackTeamId: payload.slackTeamId,
        slackChannelId: payload.slackChannelId,
        model: resolvedCompletion.model,
        provider: resolvedCompletion.provider,
        latencyMs,
        inputTokens: resolvedCompletion.usage.inputTokens,
        outputTokens: resolvedCompletion.usage.outputTokens,
        totalTokens: resolvedCompletion.usage.totalTokens,
        costUsd: resolvedCompletion.costUsd,
        externalLiteLlmRequestId: resolvedCompletion.externalLiteLlmRequestId,
      },
      "Slack AI request completed",
    );
  } catch (error) {
    const errorMessage = sanitizeJobErrorMessage(error);

    await markAiRequestFailed(auditId, errorMessage);

    logger.error(
      {
        err: errorMessage,
        aiRequestAuditId: auditId,
        organizationId: attribution.organizationId,
        slackTeamId: payload.slackTeamId,
        slackChannelId: payload.slackChannelId,
      },
      "Slack AI request failed",
    );

    if (thinkingMessageTs) {
      await updateMessage({
        channel: thinkingChannel,
        ts: thinkingMessageTs,
        text: FAILURE_MESSAGE,
      });
      return;
    }

    await postMessage({
      channel: payload.slackChannelId,
      text: FAILURE_MESSAGE,
      ...slackThreadOptions(payload),
    });
  }
}

function sanitizeJobErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, MAX_ERROR_MESSAGE_LENGTH);
  }

  return "Slack AI request failed".slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

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
            externalLiteLlmRequestId:
              reconciliation.externalLiteLlmRequestId,
          }
        : {}),
  };
}

async function resolveLiteLlmCompletionForPersistence(input: {
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

  if (reconciliation) {
    logger.info(
      {
        aiRequestAuditId: input.aiRequestAuditId,
        organizationId: input.organizationId,
        externalLiteLlmRequestId: reconciliation.externalLiteLlmRequestId,
        provider: reconciliation.provider,
        model: reconciliation.model,
        inputTokens: reconciliation.usage?.inputTokens,
        outputTokens: reconciliation.usage?.outputTokens,
        totalTokens: reconciliation.usage?.totalTokens,
        costUsd: reconciliation.costUsd,
      },
      "Reconciled LiteLLM spend data from analytics database",
    );
  }

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
