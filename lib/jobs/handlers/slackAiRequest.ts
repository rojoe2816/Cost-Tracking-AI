import "server-only";

import {
  createAiUsageEvent,
  createProcessingAiRequestAudit,
  createQueuedAiRequestAudit,
  markAiRequestCompleted,
  markAiRequestFailed,
  markAiRequestProcessing,
} from "@/lib/ai/requests";
import { usdToMicros } from "@/lib/db/costs";
import { db } from "@/lib/db";
import type { SlackAiRequestJobPayload } from "@/lib/jobs/queue";
import { sendLiteLlmChatCompletion } from "@/lib/litellm/client";
import { logger } from "@/lib/logger";
import {
  resolveSlackAttribution,
  type SlackAttribution,
} from "@/lib/slack/attribution";
import { buildUnmappedChannelAssignmentBlocks } from "@/lib/slack/blocks";
import { postMessage, updateMessage } from "@/lib/slack/client";

const SLACK_AI_SYSTEM_PROMPT =
  "You are a helpful assistant responding in Slack. Be concise and clear.";

const UNKNOWN_WORKSPACE_MESSAGE =
  "This Slack workspace is not connected to Cost Tracking AI yet. Please connect the workspace before using AI cost tracking.";

const FAILURE_MESSAGE =
  "Sorry, I could not complete that AI request. Please try again or contact an admin if this keeps happening.";

const THINKING_MESSAGE = "Thinking...";

const MAX_ERROR_MESSAGE_LENGTH = 1000;

export async function handleSlackAiRequestJob(
  payload: SlackAiRequestJobPayload,
): Promise<void> {
  const resolved = await resolveSlackAttribution({
    slackTeamId: payload.slackTeamId,
    slackChannelId: payload.slackChannelId,
  });

  const attribution = mergePayloadAttribution(resolved, payload);

  logger.info(
    {
      organizationId: attribution.organizationId,
      slackTeamId: payload.slackTeamId,
      slackChannelId: payload.slackChannelId,
      slackUserId: payload.slackUserId,
      mappingStatus: attribution.mappingStatus,
      textLength: payload.text.length,
      hasAiRequestAuditId: Boolean(payload.aiRequestAuditId),
    },
    "Resolved Slack AI request attribution",
  );

  switch (attribution.mappingStatus) {
    case "UNKNOWN_WORKSPACE":
      await handleUnknownWorkspace(payload);
      return;

    case "UNMAPPED":
      await handleUnmappedChannel(payload, attribution);
      return;

    case "MAPPED":
      await handleMappedChannel(payload, attribution);
      return;

    default: {
      const exhaustiveCheck: never = attribution.mappingStatus;
      throw new Error(`Unsupported mapping status: ${exhaustiveCheck}`);
    }
  }
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
  return ts ? { threadTs: ts } : {};
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

  const clients = await db.client.findMany({
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
  });

  // TODO: Complete client/project select menu handling in Slack interactivity.
  // TODO: Add dynamic project selection after client selection.

  const blocks = buildUnmappedChannelAssignmentBlocks({
    clients,
    originalRequestId: audit.id,
  });

  await postMessage({
    channel: payload.slackChannelId,
    text: "This channel is not mapped to a client/project yet. How should this AI usage be assigned?",
    blocks,
    ...slackThreadOptions(payload),
  });
}

async function handleMappedChannel(
  payload: SlackAiRequestJobPayload,
  attribution: SlackAttribution,
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
          content: payload.text,
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

    await markAiRequestCompleted(auditId, completion.litellmRequestId);

    await createAiUsageEvent({
      organizationId: attribution.organizationId,
      aiRequestAuditId: auditId,
      source: "SLACK",
      provider: completion.provider ?? "unknown",
      model: completion.model,
      promptTokens: completion.usage?.inputTokens ?? 0,
      completionTokens: completion.usage?.outputTokens ?? 0,
      totalTokens: completion.usage?.totalTokens ?? 0,
      totalCostMicros:
        completion.costUsd !== undefined
          ? usdToMicros(completion.costUsd)
          : 0n,
      latencyMs,
      ...(completion.litellmRequestId
        ? { externalLiteLlmRequestId: completion.litellmRequestId }
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
        model: completion.model,
        provider: completion.provider,
        latencyMs,
        inputTokens: completion.usage?.inputTokens,
        outputTokens: completion.usage?.outputTokens,
        totalTokens: completion.usage?.totalTokens,
        costUsd: completion.costUsd,
        litellmRequestId: completion.litellmRequestId,
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
