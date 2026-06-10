import { db } from "@/lib/db/prisma";

/**
 * Request lifecycle writes for AiRequestAudit.
 *
 * These functions are the seam between the Slack job queue and the database:
 * a job creates a QUEUED audit row, marks it PROCESSING before calling
 * LiteLLM, then COMPLETED or FAILED. Usage/cost facts land separately in
 * AiUsageEvent once LiteLLM processing is implemented.
 *
 * Privacy: prompt text is NOT stored here. promptStored defaults to false,
 * matching the METADATA_ONLY default in OrganizationPrivacySettings. Full
 * prompt storage requires explicit organization-level opt-in (later
 * milestone).
 */

const MAX_ERROR_MESSAGE_LENGTH = 1000;

export async function createQueuedAiRequestAudit(input: {
  organizationId: string;
  source: "SLACK" | "WEB";
  slackTeamId?: string;
  slackChannelId?: string;
  slackThreadTs?: string;
  slackMessageTs?: string;
  clientId?: string | null;
  projectId?: string | null;
  workflowTypeId?: string | null;
  promptStored?: boolean;
}): Promise<{ id: string }> {
  return db.aiRequestAudit.create({
    data: {
      organizationId: input.organizationId,
      source: input.source,
      status: "QUEUED",
      slackTeamId: input.slackTeamId ?? null,
      slackChannelId: input.slackChannelId ?? null,
      slackThreadTs: input.slackThreadTs ?? null,
      slackMessageTs: input.slackMessageTs ?? null,
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      workflowTypeId: input.workflowTypeId ?? null,
      promptStored: input.promptStored ?? false,
    },
    select: { id: true },
  });
}

export async function createProcessingAiRequestAudit(input: {
  organizationId: string;
  source: "SLACK" | "WEB";
  slackTeamId?: string;
  slackChannelId?: string;
  slackThreadTs?: string;
  slackMessageTs?: string;
  clientId?: string | null;
  projectId?: string | null;
  workflowTypeId?: string | null;
}): Promise<{ id: string }> {
  return db.aiRequestAudit.create({
    data: {
      organizationId: input.organizationId,
      source: input.source,
      status: "PROCESSING",
      slackTeamId: input.slackTeamId ?? null,
      slackChannelId: input.slackChannelId ?? null,
      slackThreadTs: input.slackThreadTs ?? null,
      slackMessageTs: input.slackMessageTs ?? null,
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      workflowTypeId: input.workflowTypeId ?? null,
      promptStored: false,
    },
    select: { id: true },
  });
}

export async function markAiRequestProcessing(
  id: string,
  input?: {
    clientId?: string | null;
    projectId?: string | null;
    workflowTypeId?: string | null;
  },
): Promise<void> {
  await db.aiRequestAudit.update({
    where: { id },
    data: {
      status: "PROCESSING",
      ...(input?.clientId !== undefined ? { clientId: input.clientId } : {}),
      ...(input?.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input?.workflowTypeId !== undefined
        ? { workflowTypeId: input.workflowTypeId }
        : {}),
    },
  });
}

export async function markAiRequestCompleted(
  id: string,
  externalLiteLlmRequestId?: string,
): Promise<void> {
  await db.aiRequestAudit.update({
    where: { id },
    data: {
      status: "COMPLETED",
      externalLiteLlmRequestId: externalLiteLlmRequestId ?? null,
      errorMessage: null,
    },
  });
}

export async function markAiRequestFailed(
  id: string,
  errorMessage: string,
): Promise<void> {
  await db.aiRequestAudit.update({
    where: { id },
    data: {
      status: "FAILED",
      errorMessage: errorMessage.slice(0, MAX_ERROR_MESSAGE_LENGTH),
    },
  });
}

export async function getAiRequestAuditById(id: string) {
  return db.aiRequestAudit.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      slackTeamId: true,
      slackChannelId: true,
      slackThreadTs: true,
      slackMessageTs: true,
      clientId: true,
      projectId: true,
      workflowTypeId: true,
      userId: true,
    },
  });
}

export async function createAiUsageEvent(input: {
  organizationId: string;
  aiRequestAuditId: string;
  source: "SLACK" | "WEB";
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCostMicros: bigint;
  latencyMs?: number;
  externalLiteLlmRequestId?: string;
  slackTeamId?: string;
  slackChannelId?: string;
  slackThreadTs?: string;
  slackMessageTs?: string;
  clientId?: string | null;
  projectId?: string | null;
  workflowTypeId?: string | null;
}): Promise<void> {
  await db.aiUsageEvent.create({
    data: {
      organizationId: input.organizationId,
      aiRequestAuditId: input.aiRequestAuditId,
      source: input.source,
      provider: input.provider,
      model: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
      totalCostMicros: input.totalCostMicros,
      ...(input.latencyMs !== undefined ? { latencyMs: input.latencyMs } : {}),
      externalLiteLlmRequestId: input.externalLiteLlmRequestId ?? null,
      slackTeamId: input.slackTeamId ?? null,
      slackChannelId: input.slackChannelId ?? null,
      slackThreadTs: input.slackThreadTs ?? null,
      slackMessageTs: input.slackMessageTs ?? null,
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      workflowTypeId: input.workflowTypeId ?? null,
    },
  });
}
