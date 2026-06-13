import { getAiRequestAuditById, markAiRequestCanceled } from "@/lib/ai/requests";
import { db } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs/queue";
import { logger } from "@/lib/logger";
import type { SlackInteractivityJobPayload } from "@/lib/queue/types";
import {
  buildUnmappedChannelAssignmentBlocks,
  parseAssignmentSelectValue,
  SLACK_ASSIGNMENT_ACTION_IDS,
} from "@/lib/slack/blocks";
import {
  createOrUpdateSlackChannelMapping,
  type SlackAttribution,
} from "@/lib/slack/attribution";
import {
  postMessage,
  SlackClientError,
  updateMessage,
} from "@/lib/slack/client";

export type SlackInteractionPayload = {
  type?: string;
  team?: { id?: string };
  user?: { id?: string };
  channel?: { id?: string; name?: string };
  message?: { ts?: string; thread_ts?: string };
  response_url?: string;
  actions?: Array<{
    action_id: string;
    value?: string;
    selected_option?: {
      value?: string;
    };
  }>;
  state?: {
    values?: Record<string, Record<string, unknown>>;
  };
};

type ParsedActionValue = {
  originalRequestId: string;
  mode: string;
};

type AssignmentReferenceData = {
  clients: Array<{ id: string; name: string }>;
  projects: Array<{
    id: string;
    name: string;
    clientId: string;
    clientName: string | null;
  }>;
  workflowTypes: Array<{ id: string; name: string }>;
};

type SelectedAssignmentState = {
  originalRequestId: string | null;
  clientId: string | null;
  projectId: string | null;
  workflowTypeId: string | null;
};

const SUPPORTED_ACTION_IDS = new Set([
  SLACK_ASSIGNMENT_ACTION_IDS.selectClient,
  SLACK_ASSIGNMENT_ACTION_IDS.selectProject,
  SLACK_ASSIGNMENT_ACTION_IDS.selectWorkflow,
  SLACK_ASSIGNMENT_ACTION_IDS.assignOnce,
  SLACK_ASSIGNMENT_ACTION_IDS.mapChannel,
  SLACK_ASSIGNMENT_ACTION_IDS.assignInternal,
  SLACK_ASSIGNMENT_ACTION_IDS.cancel,
  // Backwards compatibility for local scripts/tests that used the initial IDs.
  "select_client",
  "assign_once",
  "map_channel",
  "assign_internal",
  "cancel_assignment",
]);

const ACTION_ID_TO_MODE: Record<string, string> = {
  [SLACK_ASSIGNMENT_ACTION_IDS.assignOnce]: "ASSIGN_ONCE",
  [SLACK_ASSIGNMENT_ACTION_IDS.mapChannel]: "MAP_CHANNEL",
  [SLACK_ASSIGNMENT_ACTION_IDS.assignInternal]: "ASSIGN_INTERNAL",
  [SLACK_ASSIGNMENT_ACTION_IDS.cancel]: "CANCEL",
  assign_once: "ASSIGN_ONCE",
  map_channel: "MAP_CHANNEL",
  assign_internal: "ASSIGN_INTERNAL",
  cancel_assignment: "CANCEL",
};

const MESSAGE_RECOVERY_FAILURE_TEXT =
  "I could not recover the original Slack message. Please send the request again.";

const ASSIGNMENT_STATUS_MESSAGES = {
  assignOnce: "Assigned this request once. Processing...",
  mapChannel: "Channel mapped. Processing...",
  assignInternal: "Assigned as internal/no client. Processing...",
  cancel: "Canceled. No AI usage was recorded.",
} as const;

const ASSIGNMENT_PROMPT_TEXT =
  "Slate needs attribution before this AI request can be processed.";

export function parseSlackInteractivePayload(rawBody: string):
  | { ok: true; payload: SlackInteractionPayload }
  | { ok: false; reason: string } {
  const form = new URLSearchParams(rawBody);
  const payloadJson = form.get("payload");

  if (!payloadJson) {
    return { ok: false, reason: "Missing payload field" };
  }

  try {
    const payload = JSON.parse(payloadJson) as SlackInteractionPayload;
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "Invalid payload JSON" };
  }
}

export function parseActionValue(value: string | undefined):
  | { ok: true; value: ParsedActionValue }
  | { ok: false; reason: string } {
  if (!value) {
    return { ok: false, reason: "Missing action value" };
  }

  try {
    const parsed = JSON.parse(value) as Partial<ParsedActionValue>;

    if (!parsed.originalRequestId || typeof parsed.originalRequestId !== "string") {
      return { ok: false, reason: "Missing originalRequestId in action value" };
    }

    if (!parsed.mode || typeof parsed.mode !== "string") {
      return { ok: false, reason: "Missing mode in action value" };
    }

    return {
      ok: true,
      value: {
        originalRequestId: parsed.originalRequestId,
        mode: parsed.mode,
      },
    };
  } catch {
    return { ok: false, reason: "Invalid action value JSON" };
  }
}

export function isSupportedInteractiveAction(actionId: string | undefined) {
  return Boolean(actionId && SUPPORTED_ACTION_IDS.has(actionId));
}

export function extractSelectedClientId(
  payload: SlackInteractionPayload,
): string | null {
  return extractSelectedAssignmentState(payload).clientId;
}

export function extractSelectedProjectId(
  payload: SlackInteractionPayload,
): string | null {
  return extractSelectedAssignmentState(payload).projectId;
}

export function extractSelectedWorkflowTypeId(
  payload: SlackInteractionPayload,
): string | null {
  return extractSelectedAssignmentState(payload).workflowTypeId;
}

export function extractSelectedAssignmentState(
  payload: SlackInteractionPayload,
): SelectedAssignmentState {
  const selected: SelectedAssignmentState = {
    originalRequestId: null,
    clientId: null,
    projectId: null,
    workflowTypeId: null,
  };

  for (const actionGroup of Object.values(payload.state?.values ?? {})) {
    for (const [actionId, actionState] of Object.entries(actionGroup)) {
      applySelectedOptionValue(selected, actionState, actionId);
    }
  }

  const currentAction = payload.actions?.[0];

  if (currentAction?.selected_option) {
    applySelectedOptionValue(
      selected,
      { selected_option: currentAction.selected_option },
      currentAction.action_id,
    );
  }

  return selected;
}

function applySelectedOptionValue(
  selected: SelectedAssignmentState,
  actionState: unknown,
  actionId: string,
) {
  if (
    typeof actionState !== "object" ||
    actionState === null ||
    !("selected_option" in actionState)
  ) {
    return;
  }

  const selectedOption = (
    actionState as { selected_option?: { value?: string } }
  ).selected_option;

  if (!selectedOption?.value) {
    return;
  }

  const parsed = parseAssignmentSelectValue(selectedOption.value);

  if (parsed.ok) {
    selected.originalRequestId = parsed.value.originalRequestId;

    switch (parsed.value.kind) {
      case "CLIENT":
        selected.clientId = parsed.value.entityId;
        return;
      case "PROJECT":
        selected.projectId = parsed.value.entityId;
        return;
      case "WORKFLOW":
        selected.workflowTypeId = parsed.value.entityId;
        return;
      default: {
        const exhaustiveCheck: never = parsed.value.kind;
        throw new Error(`Unsupported assignment select kind: ${exhaustiveCheck}`);
      }
    }
  }

  // Legacy local payloads used the raw client ID as the option value.
  if (
    actionId === "select_client" ||
    actionId === SLACK_ASSIGNMENT_ACTION_IDS.selectClient
  ) {
    selected.clientId = selectedOption.value;
  }
}

function inferChannelType(channelId: string | undefined): string | undefined {
  if (!channelId) {
    return undefined;
  }

  if (channelId.startsWith("D")) {
    return "im";
  }

  if (channelId.startsWith("G")) {
    return "mpim";
  }

  return "channel";
}

function validateActionMode(actionId: string, mode: string): boolean {
  return ACTION_ID_TO_MODE[actionId] === mode;
}

function isAssignmentSelectAction(actionId: string): boolean {
  return (
    actionId === SLACK_ASSIGNMENT_ACTION_IDS.selectClient ||
    actionId === SLACK_ASSIGNMENT_ACTION_IDS.selectProject ||
    actionId === SLACK_ASSIGNMENT_ACTION_IDS.selectWorkflow ||
    actionId === "select_client"
  );
}

async function lookupOriginalRequest(originalRequestId: string) {
  const audit = await getAiRequestAuditById(originalRequestId);

  if (!audit) {
    logger.warn(
      { originalRequestId },
      "Original AI request audit not found; cannot resume processing",
    );
    return null;
  }

  return audit;
}

function hasResumeSlackMetadata(
  audit: NonNullable<Awaited<ReturnType<typeof lookupOriginalRequest>>>,
): audit is NonNullable<Awaited<ReturnType<typeof lookupOriginalRequest>>> & {
  slackTeamId: string;
  slackChannelId: string;
  slackUserId: string;
  slackMessageTs: string;
} {
  return Boolean(
    audit.slackTeamId &&
      audit.slackChannelId &&
      audit.slackUserId &&
      audit.slackMessageTs,
  );
}

async function notifyMessageRecoveryFailure(input: {
  audit: NonNullable<Awaited<ReturnType<typeof lookupOriginalRequest>>>;
  fallbackChannelId: string;
}) {
  const channel = input.audit.slackChannelId ?? input.fallbackChannelId;
  const threadTs = input.audit.slackThreadTs ?? input.audit.slackMessageTs ?? undefined;

  await postMessage({
    channel,
    text: MESSAGE_RECOVERY_FAILURE_TEXT,
    ...(threadTs ? { threadTs } : {}),
  });
}

async function updateAssignmentMessage(
  payload: SlackInteractionPayload,
  text: string,
  blocks?: ReturnType<typeof buildUnmappedChannelAssignmentBlocks>,
): Promise<void> {
  const channel = payload.channel?.id;
  const ts = payload.message?.ts;

  if (!channel || !ts) {
    logger.warn(
      {
        hasChannel: Boolean(channel),
        hasMessageTs: Boolean(ts),
      },
      "Assignment message ts missing; skipping chat.update",
    );
    // TODO: response_url fallback if payload.message.ts is unavailable.
    return;
  }

  try {
    await updateMessage({
      channel,
      ts,
      text,
      ...(blocks ? { blocks } : {}),
    });
  } catch (error) {
    logger.error(
      {
        err: error instanceof SlackClientError ? error.message : "Slack update failed",
        channel,
        messageTs: ts,
      },
      "Failed to update assignment Slack message",
    );
  }
}

async function loadAssignmentReferenceData(
  organizationId: string,
): Promise<AssignmentReferenceData> {
  const [clients, projects, workflowTypes] = await Promise.all([
    db.client.findMany({
      where: {
        organizationId,
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
        organizationId,
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
        organizationId,
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

  return {
    clients,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      clientId: project.clientId,
      clientName: project.client.name,
    })),
    workflowTypes,
  };
}

function normalizeSelectedAssignment(
  selected: SelectedAssignmentState,
  references: AssignmentReferenceData,
): SelectedAssignmentState {
  let selectedClientId = references.clients.some(
    (client) => client.id === selected.clientId,
  )
    ? selected.clientId
    : null;

  const selectedProject = references.projects.find(
    (project) => project.id === selected.projectId,
  );

  if (!selectedClientId && selectedProject) {
    selectedClientId = selectedProject.clientId;
  }

  const selectedProjectId =
    selectedProject &&
    (!selectedClientId || selectedProject.clientId === selectedClientId)
      ? selectedProject.id
      : null;

  const selectedWorkflowTypeId = references.workflowTypes.some(
    (workflowType) => workflowType.id === selected.workflowTypeId,
  )
    ? selected.workflowTypeId
    : null;

  return {
    originalRequestId: selected.originalRequestId,
    clientId: selectedClientId,
    projectId: selectedProjectId,
    workflowTypeId: selectedWorkflowTypeId,
  };
}

async function rebuildAssignmentMessage(input: {
  payload: SlackInteractionPayload;
  audit: NonNullable<Awaited<ReturnType<typeof lookupOriginalRequest>>>;
  selected: SelectedAssignmentState;
  validationMessage?: string;
}) {
  const references = await loadAssignmentReferenceData(input.audit.organizationId);
  const normalized = normalizeSelectedAssignment(input.selected, references);

  const blocks = buildUnmappedChannelAssignmentBlocks({
    clients: references.clients,
    projects: references.projects,
    workflowTypes: references.workflowTypes,
    originalRequestId: input.audit.id,
    slackTeamId: input.audit.slackTeamId,
    slackChannelId: input.audit.slackChannelId,
    ...(input.payload.channel?.name
      ? { slackChannelName: input.payload.channel.name }
      : {}),
    selectedClientId: normalized.clientId,
    selectedProjectId: normalized.projectId,
    selectedWorkflowTypeId: normalized.workflowTypeId,
    ...(input.validationMessage
      ? { validationMessage: input.validationMessage }
      : {}),
  });

  await updateAssignmentMessage(input.payload, ASSIGNMENT_PROMPT_TEXT, blocks);

  return normalized;
}

async function resumeOriginalRequest(input: {
  audit: NonNullable<Awaited<ReturnType<typeof lookupOriginalRequest>>>;
  fallbackChannelId: string;
  attribution: SlackAttribution;
}): Promise<boolean> {
  const { audit, attribution } = input;

  if (!hasResumeSlackMetadata(audit)) {
    logger.warn(
      {
        originalRequestId: audit.id,
        hasSlackTeamId: Boolean(audit.slackTeamId),
        hasSlackChannelId: Boolean(audit.slackChannelId),
        hasSlackUserId: Boolean(audit.slackUserId),
        hasSlackMessageTs: Boolean(audit.slackMessageTs),
      },
      "Original AI request audit missing Slack metadata; cannot resume",
    );
    await notifyMessageRecoveryFailure(input);
    return false;
  }

  await enqueueJob(
    "slack.ai_request",
    {
      organizationId: attribution.organizationId ?? audit.organizationId,
      slackTeamId: audit.slackTeamId,
      slackChannelId: audit.slackChannelId,
      slackUserId: audit.slackUserId,
      ...(audit.slackThreadTs ? { threadTs: audit.slackThreadTs } : {}),
      messageTs: audit.slackMessageTs,
      clientId: attribution.clientId,
      projectId: attribution.projectId,
      workflowTypeId: attribution.workflowTypeId,
      mappingStatus: "MAPPED",
      aiRequestAuditId: audit.id,
    },
    {
      idempotencyKey: `slack:ai_request:audit:${audit.id}`,
    },
  );

  return true;
}

/**
 * Handles a verified Slack interactive action outside the HTTP request lifecycle.
 * No LiteLLM or provider calls happen here.
 */
export async function handleSlackInteractiveAction(
  payload: SlackInteractionPayload,
  options?: {
    selectedState?: SelectedAssignmentState;
  },
): Promise<void> {
  const action = payload.actions?.[0];

  if (!action || !isSupportedInteractiveAction(action.action_id)) {
    logger.info(
      { actionId: action?.action_id },
      "Ignoring unsupported Slack interactive action",
    );
    return;
  }

  const slackTeamId = payload.team?.id;
  const slackChannelId = payload.channel?.id;
  const slackUserId = payload.user?.id;

  if (!slackTeamId || !slackChannelId || !slackUserId) {
    logger.warn(
      {
        actionId: action.action_id,
        hasTeamId: Boolean(slackTeamId),
        hasChannelId: Boolean(slackChannelId),
        hasUserId: Boolean(slackUserId),
      },
      "Slack interactive payload missing team, channel, or user",
    );
    return;
  }

  const selectedState =
    options?.selectedState ?? extractSelectedAssignmentState(payload);

  if (isAssignmentSelectAction(action.action_id)) {
    if (!selectedState.originalRequestId) {
      logger.warn(
        {
          actionId: action.action_id,
          slackTeamId,
          slackChannelId,
        },
        "Slack assignment select payload missing original request id",
      );
      return;
    }

    const audit = await lookupOriginalRequest(selectedState.originalRequestId);

    if (!audit) {
      return;
    }

    await rebuildAssignmentMessage({
      payload,
      audit,
      selected: selectedState,
    });

    logger.info(
      {
        actionId: action.action_id,
        originalRequestId: audit.id,
        slackTeamId,
        slackChannelId,
      },
      "Updated Slack assignment UI after select action",
    );
    return;
  }

  const parsedValue = parseActionValue(action.value);

  if (!parsedValue.ok) {
    logger.warn(
      {
        actionId: action.action_id,
        reason: parsedValue.reason,
      },
      "Invalid Slack interactive action value",
    );
    return;
  }

  if (!validateActionMode(action.action_id, parsedValue.value.mode)) {
    logger.warn(
      {
        actionId: action.action_id,
        mode: parsedValue.value.mode,
      },
      "Slack action mode does not match action_id",
    );
    return;
  }

  if (parsedValue.value.mode === "CANCEL") {
    const audit = await lookupOriginalRequest(parsedValue.value.originalRequestId);

    if (audit) {
      await markAiRequestCanceled(audit.id);
    }

    await updateAssignmentMessage(payload, ASSIGNMENT_STATUS_MESSAGES.cancel);

    logger.info(
      {
        actionId: action.action_id,
        originalRequestId: parsedValue.value.originalRequestId,
        slackTeamId,
        slackChannelId,
      },
      "Slack assignment canceled by user",
    );
    return;
  }

  const audit = await lookupOriginalRequest(parsedValue.value.originalRequestId);

  if (!audit) {
    return;
  }

  const channelType = inferChannelType(slackChannelId);

  if (parsedValue.value.mode === "ASSIGN_INTERNAL") {
    const resumed = await resumeOriginalRequest({
      audit,
      fallbackChannelId: slackChannelId,
      attribution: {
        organizationId: audit.organizationId,
        clientId: null,
        projectId: null,
        workflowTypeId: null,
        mappingStatus: "MAPPED",
      },
    });

    if (resumed) {
      await updateAssignmentMessage(
        payload,
        ASSIGNMENT_STATUS_MESSAGES.assignInternal,
      );
    }

    return;
  }

  const references = await loadAssignmentReferenceData(audit.organizationId);
  const normalizedSelection = normalizeSelectedAssignment(
    selectedState,
    references,
  );

  if (!normalizedSelection.clientId) {
    logger.warn(
      {
        actionId: action.action_id,
        originalRequestId: parsedValue.value.originalRequestId,
        slackTeamId,
        slackChannelId,
      },
      "Client selection required for assign_once/map_channel but none was provided",
    );
    await rebuildAssignmentMessage({
      payload,
      audit,
      selected: normalizedSelection,
      validationMessage:
        "Choose a client before using Assign once or Map this channel.",
    });
    return;
  }

  const mappingMode =
    parsedValue.value.mode === "MAP_CHANNEL" ? "MAP_CHANNEL" : "ASSIGN_ONCE";

  const attribution = await createOrUpdateSlackChannelMapping({
    mode: mappingMode,
    organizationId: audit.organizationId,
    slackTeamId,
    slackChannelId,
    ...(payload.channel?.name ? { slackChannelName: payload.channel.name } : {}),
    clientId: normalizedSelection.clientId,
    projectId: normalizedSelection.projectId,
    workflowTypeId: normalizedSelection.workflowTypeId,
    ...(channelType ? { channelType } : {}),
  });

  if (attribution.mappingStatus === "UNKNOWN_WORKSPACE") {
    logger.warn(
      {
        actionId: action.action_id,
        originalRequestId: parsedValue.value.originalRequestId,
        slackTeamId,
      },
      "Slack workspace unknown; cannot apply channel attribution",
    );
    return;
  }

  const resumed = await resumeOriginalRequest({
    audit,
    fallbackChannelId: slackChannelId,
    attribution,
  });

  if (resumed) {
    await updateAssignmentMessage(
      payload,
      parsedValue.value.mode === "MAP_CHANNEL"
        ? ASSIGNMENT_STATUS_MESSAGES.mapChannel
        : ASSIGNMENT_STATUS_MESSAGES.assignOnce,
    );
  }
}

export function buildSlackInteractivityJobPayload(
  payload: SlackInteractionPayload,
): SlackInteractivityJobPayload | null {
  const action = payload.actions?.[0];
  const slackTeamId = payload.team?.id;
  const slackChannelId = payload.channel?.id;
  const slackUserId = payload.user?.id;

  if (!action || !slackTeamId || !slackChannelId || !slackUserId) {
    return null;
  }

  const selected = extractSelectedAssignmentState(payload);

  return {
    actionId: action.action_id,
    slackTeamId,
    slackChannelId,
    ...(payload.channel?.name ? { slackChannelName: payload.channel.name } : {}),
    slackUserId,
    ...(payload.message?.ts ? { messageTs: payload.message.ts } : {}),
    ...(payload.message?.thread_ts
      ? { threadTs: payload.message.thread_ts }
      : {}),
    ...(action.value ? { actionValue: action.value } : {}),
    originalRequestId: selected.originalRequestId,
    selectedClientId: selected.clientId,
    selectedProjectId: selected.projectId,
    selectedWorkflowTypeId: selected.workflowTypeId,
  };
}

export function buildInteractivityIdempotencyKey(
  job: SlackInteractivityJobPayload,
): string {
  const messageTs = job.messageTs ?? "no-message";
  const selectionTail = [
    job.actionValue ?? "",
    job.originalRequestId ?? "",
    job.selectedClientId ?? "",
    job.selectedProjectId ?? "",
    job.selectedWorkflowTypeId ?? "",
  ].join(":");

  return `slack:interactivity:${job.slackTeamId}:${job.slackChannelId}:${messageTs}:${job.actionId}:${selectionTail}`;
}

function buildInteractionPayloadFromJob(
  job: SlackInteractivityJobPayload,
): SlackInteractionPayload {
  return {
    type: "block_actions",
    team: { id: job.slackTeamId },
    user: { id: job.slackUserId },
    channel: {
      id: job.slackChannelId,
      ...(job.slackChannelName ? { name: job.slackChannelName } : {}),
    },
    message: {
      ...(job.messageTs ? { ts: job.messageTs } : {}),
      ...(job.threadTs ? { thread_ts: job.threadTs } : {}),
    },
    actions: [
      {
        action_id: job.actionId,
        ...(job.actionValue ? { value: job.actionValue } : {}),
      },
    ],
  };
}

export async function handleSlackInteractivityJob(
  job: SlackInteractivityJobPayload,
): Promise<void> {
  await handleSlackInteractiveAction(buildInteractionPayloadFromJob(job), {
    selectedState: {
      originalRequestId: job.originalRequestId ?? null,
      clientId: job.selectedClientId ?? null,
      projectId: job.selectedProjectId ?? null,
      workflowTypeId: job.selectedWorkflowTypeId ?? null,
    },
  });
}
