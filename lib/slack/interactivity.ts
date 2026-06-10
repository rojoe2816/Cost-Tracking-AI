import { getAiRequestAuditById } from "@/lib/ai/requests";
import { enqueueJob } from "@/lib/jobs";
import { logger } from "@/lib/logger";
import {
  createOrUpdateSlackChannelMapping,
  type SlackAttribution,
} from "@/lib/slack/attribution";
import { fetchMessageText, postSlackMessage } from "@/lib/slack/client";

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
  }>;
  state?: {
    values?: Record<string, Record<string, unknown>>;
  };
};

type ParsedActionValue = {
  originalRequestId: string;
  mode: string;
};

const SUPPORTED_ACTION_IDS = new Set([
  "assign_once",
  "map_channel",
  "assign_internal",
  "cancel_assignment",
]);

const ACTION_ID_TO_MODE: Record<string, string> = {
  assign_once: "ASSIGN_ONCE",
  map_channel: "MAP_CHANNEL",
  assign_internal: "ASSIGN_INTERNAL",
  cancel_assignment: "CANCEL",
};

const MESSAGE_RECOVERY_FAILURE_TEXT =
  "I could not recover the original Slack message. Please send the request again.";

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

/**
 * Reads the selected client from Block Kit `state.values`.
 *
 * TODO: Expand when client/project select menus are finalized, including
 * dynamic project selection after a client is chosen through Slack
 * interactivity.
 */
export function extractSelectedClientId(
  payload: SlackInteractionPayload,
): string | null {
  const selectState = payload.state?.values?.client_assignment?.select_client;

  if (
    typeof selectState === "object" &&
    selectState !== null &&
    "selected_option" in selectState
  ) {
    const selectedOption = (
      selectState as { selected_option?: { value?: string } }
    ).selected_option;

    if (selectedOption?.value) {
      return selectedOption.value;
    }
  }

  return null;
}

export function extractSelectedProjectId(): string | null {
  // TODO: Add project extraction once project dropdown is wired after client
  // selection.
  return null;
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

  await postSlackMessage({
    channel,
    text: MESSAGE_RECOVERY_FAILURE_TEXT,
    ...(threadTs ? { threadTs } : {}),
  });
}

async function resumeOriginalRequest(input: {
  audit: NonNullable<Awaited<ReturnType<typeof lookupOriginalRequest>>>;
  fallbackChannelId: string;
  attribution: SlackAttribution;
}) {
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
    return;
  }

  const { text } = await fetchMessageText({
    channel: audit.slackChannelId,
    messageTs: audit.slackMessageTs,
    threadTs: audit.slackThreadTs,
  });

  if (!text) {
    logger.warn(
      {
        originalRequestId: audit.id,
        slackTeamId: audit.slackTeamId,
        slackChannelId: audit.slackChannelId,
        hasSlackThreadTs: Boolean(audit.slackThreadTs),
      },
      "Could not recover original Slack message text",
    );
    await notifyMessageRecoveryFailure(input);
    return;
  }

  await enqueueJob("slack.ai_request", {
    organizationId: attribution.organizationId ?? audit.organizationId,
    slackTeamId: audit.slackTeamId,
    slackChannelId: audit.slackChannelId,
    slackUserId: audit.slackUserId,
    text,
    threadTs: audit.slackThreadTs ?? audit.slackMessageTs,
    messageTs: audit.slackMessageTs,
    clientId: attribution.clientId,
    projectId: attribution.projectId,
    workflowTypeId: attribution.workflowTypeId,
    mappingStatus: "MAPPED",
    aiRequestAuditId: audit.id,
  });
}

/**
 * Handles a verified Slack interactive action outside the HTTP request lifecycle.
 * No LiteLLM or provider calls happen here.
 */
export async function handleSlackInteractiveAction(
  payload: SlackInteractionPayload,
): Promise<void> {
  const action = payload.actions?.[0];

  if (!action || !isSupportedInteractiveAction(action.action_id)) {
    logger.info(
      { actionId: action?.action_id },
      "Ignoring unsupported Slack interactive action",
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

  if (action.action_id === "cancel_assignment") {
    logger.info(
      {
        actionId: action.action_id,
        originalRequestId: parsedValue.value.originalRequestId,
        slackTeamId,
        slackChannelId,
      },
      "Slack assignment canceled by user",
    );
    // TODO: Update the original Slack message from the async worker using chat.update.
    return;
  }

  const audit = await lookupOriginalRequest(parsedValue.value.originalRequestId);

  if (!audit) {
    return;
  }

  const selectedClientId = extractSelectedClientId(payload);
  const selectedProjectId = extractSelectedProjectId();
  const channelType = inferChannelType(slackChannelId);

  if (action.action_id === "assign_internal") {
    await resumeOriginalRequest({
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

    // TODO: Update the original Slack message from the async worker using chat.update.
    return;
  }

  if (!selectedClientId) {
    logger.warn(
      {
        actionId: action.action_id,
        originalRequestId: parsedValue.value.originalRequestId,
        slackTeamId,
        slackChannelId,
      },
      "Client selection required for assign_once/map_channel but none was provided",
    );
    // TODO: Respond in Slack asking the user to choose a client before retrying.
    return;
  }

  // TODO: Validate selected client/project belong to organization before enqueue.
  const mappingMode =
    action.action_id === "map_channel" ? "MAP_CHANNEL" : "ASSIGN_ONCE";

  const attribution = await createOrUpdateSlackChannelMapping({
    mode: mappingMode,
    organizationId: audit.organizationId,
    slackTeamId,
    slackChannelId,
    ...(payload.channel?.name ? { slackChannelName: payload.channel.name } : {}),
    clientId: selectedClientId,
    projectId: selectedProjectId,
    workflowTypeId: audit.workflowTypeId,
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

  await resumeOriginalRequest({
    audit,
    fallbackChannelId: slackChannelId,
    attribution,
  });

  // TODO: Update the original Slack message from the async worker using chat.update.
}
