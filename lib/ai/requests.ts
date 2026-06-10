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
      promptStored: input.promptStored ?? false,
    },
    select: { id: true },
  });
}

export async function markAiRequestProcessing(id: string): Promise<void> {
  await db.aiRequestAudit.update({
    where: { id },
    data: { status: "PROCESSING" },
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
