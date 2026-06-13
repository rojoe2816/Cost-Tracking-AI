import type { SlackMappingStatus } from "@/lib/slack/attribution";

export type JobName = "slack.ai_request" | "slack.interactivity";

export type SlackAiRequestJobPayload = {
  organizationId?: string | null;
  slackTeamId: string;
  slackChannelId: string;
  slackUserId: string;
  /** Transient inline text for in-memory tests only. Never persisted to Postgres. */
  text?: string;
  threadTs?: string;
  messageTs?: string;
  clientId?: string | null;
  projectId?: string | null;
  workflowTypeId?: string | null;
  mappingStatus?: SlackMappingStatus;
  aiRequestAuditId?: string;
};

export type SlackInteractivityJobPayload = {
  actionId: string;
  slackTeamId: string;
  slackChannelId: string;
  slackChannelName?: string;
  slackUserId: string;
  messageTs?: string;
  threadTs?: string;
  actionValue?: string;
  originalRequestId?: string | null;
  selectedClientId?: string | null;
  selectedProjectId?: string | null;
  selectedWorkflowTypeId?: string | null;
};

export type JobPayloadByName = {
  "slack.ai_request": SlackAiRequestJobPayload;
  "slack.interactivity": SlackInteractivityJobPayload;
};

export type EnqueueJobOptions = {
  idempotencyKey?: string;
  runAfter?: Date;
  maxAttempts?: number;
};

export type PersistedJobPayload = JobPayloadByName[JobName];

export function sanitizeSlackAiRequestPayloadForStorage(
  payload: SlackAiRequestJobPayload,
): Omit<SlackAiRequestJobPayload, "text"> {
  return {
    ...(payload.organizationId !== undefined
      ? { organizationId: payload.organizationId }
      : {}),
    slackTeamId: payload.slackTeamId,
    slackChannelId: payload.slackChannelId,
    slackUserId: payload.slackUserId,
    ...(payload.threadTs ? { threadTs: payload.threadTs } : {}),
    ...(payload.messageTs ? { messageTs: payload.messageTs } : {}),
    ...(payload.clientId !== undefined ? { clientId: payload.clientId } : {}),
    ...(payload.projectId !== undefined ? { projectId: payload.projectId } : {}),
    ...(payload.workflowTypeId !== undefined
      ? { workflowTypeId: payload.workflowTypeId }
      : {}),
    ...(payload.mappingStatus ? { mappingStatus: payload.mappingStatus } : {}),
    ...(payload.aiRequestAuditId
      ? { aiRequestAuditId: payload.aiRequestAuditId }
      : {}),
  };
}

export function safeSlackAiRequestJobMetadata(payload: SlackAiRequestJobPayload) {
  return {
    organizationId: payload.organizationId,
    slackTeamId: payload.slackTeamId,
    slackChannelId: payload.slackChannelId,
    slackUserId: payload.slackUserId,
    hasThreadTs: Boolean(payload.threadTs),
    hasMessageTs: Boolean(payload.messageTs),
    hasInlineText: Boolean(payload.text),
    textLength: payload.text?.length ?? 0,
    mappingStatus: payload.mappingStatus,
    hasClientId: Boolean(payload.clientId),
    hasProjectId: Boolean(payload.projectId),
    hasWorkflowTypeId: Boolean(payload.workflowTypeId),
    hasAiRequestAuditId: Boolean(payload.aiRequestAuditId),
  };
}

export function safeSlackInteractivityJobMetadata(
  payload: SlackInteractivityJobPayload,
) {
  return {
    actionId: payload.actionId,
    slackTeamId: payload.slackTeamId,
    slackChannelId: payload.slackChannelId,
    slackUserId: payload.slackUserId,
    hasMessageTs: Boolean(payload.messageTs),
    hasActionValue: Boolean(payload.actionValue),
    hasOriginalRequestId: Boolean(payload.originalRequestId),
  };
}
