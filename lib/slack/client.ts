import "server-only";

import { env } from "@/lib/env";
import {
  classifySecret,
  combineStatuses,
  type IntegrationStatus,
} from "@/lib/integration-status";
import { logger } from "@/lib/logger";
import type { SlackBlock } from "@/lib/slack/blocks";

export interface SlackRuntimeConfig {
  status: IntegrationStatus;
  hasBotToken: boolean;
  hasSigningSecret: boolean;
}

const SLACK_API_BASE = "https://slack.com/api";

type SlackApiResponse = {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
  message_ts?: string;
};

export class SlackClientError extends Error {
  constructor(
    message: string,
    public readonly details?: {
      method?: string;
      slackError?: string;
      status?: number;
    },
  ) {
    super(message);
    this.name = "SlackClientError";
  }
}

/**
 * Lightweight config inspection only — no network health checks here.
 * "placeholder" means the .env.example dev values are still in use.
 */
export function getSlackRuntimeConfig(): SlackRuntimeConfig {
  return {
    status: combineStatuses(
      classifySecret(env.SLACK_BOT_TOKEN),
      classifySecret(env.SLACK_SIGNING_SECRET),
    ),
    hasBotToken: Boolean(env.SLACK_BOT_TOKEN),
    hasSigningSecret: Boolean(env.SLACK_SIGNING_SECRET),
  };
}

/**
 * Throws when Slack credentials are absent. Call this from routes/jobs that
 * actually need the Slack Web API, not at module load or app boot.
 */
export function assertSlackConfigured(): {
  botToken: string;
  signingSecret: string;
} {
  if (!env.SLACK_BOT_TOKEN || !env.SLACK_SIGNING_SECRET) {
    throw new Error(
      "Slack is not configured. Set SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET in .env.",
    );
  }

  return {
    botToken: env.SLACK_BOT_TOKEN,
    signingSecret: env.SLACK_SIGNING_SECRET,
  };
}

export function createSlackAuthHeaders() {
  const { botToken } = assertSlackConfigured();

  return {
    Authorization: `Bearer ${botToken}`,
  };
}

function assertSlackBotTokenForApi(method: string): string {
  const token = env.SLACK_BOT_TOKEN?.trim();

  if (!token) {
    throw new SlackClientError("Slack bot token is not configured", {
      method,
      slackError: "not_configured",
    });
  }

  if (classifySecret(token) === "placeholder") {
    throw new SlackClientError("Slack bot token is a dev placeholder", {
      method,
      slackError: "placeholder_token",
    });
  }

  return token;
}

async function callSlackApi<T extends SlackApiResponse>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const botToken = assertSlackBotTokenForApi(method);

  const response = await fetch(`${SLACK_API_BASE}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new SlackClientError(`Slack API ${method} returned HTTP ${response.status}`, {
      method,
      status: response.status,
    });
  }

  const data = (await response.json().catch(() => null)) as T | null;

  if (!data) {
    throw new SlackClientError(`Slack API ${method} returned invalid JSON`, {
      method,
      status: response.status,
    });
  }

  if (!data.ok) {
    throw new SlackClientError(`Slack API ${method} failed`, {
      method,
      ...(data.error ? { slackError: data.error } : {}),
      status: response.status,
    });
  }

  logger.debug(
    {
      method,
      channel: typeof body.channel === "string" ? body.channel : undefined,
      hasBlocks: Array.isArray(body.blocks),
      hasThreadTs: typeof body.thread_ts === "string",
      returnedTs: data.ts ?? data.message_ts,
      status: response.status,
    },
    "Slack API call succeeded",
  );

  return data;
}

export async function postMessage(input: {
  channel: string;
  threadTs?: string;
  text: string;
  blocks?: SlackBlock[];
}): Promise<{ ts: string }> {
  const data = await callSlackApi<SlackApiResponse>("chat.postMessage", {
    channel: input.channel,
    text: input.text,
    ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
    ...(input.blocks ? { blocks: input.blocks } : {}),
  });

  if (!data.ts) {
    throw new SlackClientError("Slack chat.postMessage response missing ts", {
      method: "chat.postMessage",
    });
  }

  return { ts: data.ts };
}

export async function updateMessage(input: {
  channel: string;
  ts: string;
  text: string;
  blocks?: SlackBlock[];
}): Promise<{ ts: string }> {
  const data = await callSlackApi<SlackApiResponse>("chat.update", {
    channel: input.channel,
    ts: input.ts,
    text: input.text,
    ...(input.blocks ? { blocks: input.blocks } : {}),
  });

  if (!data.ts) {
    throw new SlackClientError("Slack chat.update response missing ts", {
      method: "chat.update",
    });
  }

  return { ts: data.ts };
}

export async function postEphemeral(input: {
  channel: string;
  user: string;
  text: string;
  blocks?: SlackBlock[];
}): Promise<{ messageTs?: string }> {
  const data = await callSlackApi<SlackApiResponse>("chat.postEphemeral", {
    channel: input.channel,
    user: input.user,
    text: input.text,
    ...(input.blocks ? { blocks: input.blocks } : {}),
  });

  return {
    ...(data.message_ts ? { messageTs: data.message_ts } : {}),
  };
}

type SlackConversationMessage = {
  ts?: string;
  text?: string;
};

type ConversationsHistoryResponse = SlackApiResponse & {
  messages?: SlackConversationMessage[];
};

type ConversationsRepliesResponse = SlackApiResponse & {
  messages?: SlackConversationMessage[];
};

/**
 * Fetches the text of a Slack message by channel and timestamp.
 *
 * Requires bot token scopes such as channels:history, groups:history,
 * im:history, and mpim:history depending on channel type.
 *
 * Message text is returned to the caller only — it is never logged here.
 */
export async function fetchMessageText(input: {
  channel: string;
  messageTs: string;
  threadTs?: string | null;
}): Promise<{ text: string | null }> {
  const useReplies =
    Boolean(input.threadTs) && input.threadTs !== input.messageTs;

  if (useReplies && input.threadTs) {
    const data = await callSlackApi<ConversationsRepliesResponse>(
      "conversations.replies",
      {
        channel: input.channel,
        ts: input.threadTs,
        limit: 200,
      },
    );

    const message = data.messages?.find((entry) => entry.ts === input.messageTs);
    const text = message?.text?.trim();

    return { text: text || null };
  }

  const data = await callSlackApi<ConversationsHistoryResponse>(
    "conversations.history",
    {
      channel: input.channel,
      latest: input.messageTs,
      inclusive: true,
      limit: 1,
    },
  );

  const text = data.messages?.[0]?.text?.trim();

  return { text: text || null };
}

/** @deprecated Use postMessage instead. */
export async function postSlackMessage(input: {
  channel: string;
  text: string;
  threadTs?: string;
  blocks?: SlackBlock[];
}): Promise<{ ts: string; channel: string }> {
  const result = await postMessage(input);

  return {
    ts: result.ts,
    channel: input.channel,
  };
}

/** @deprecated Use updateMessage instead. */
export async function updateSlackMessage(input: {
  channel: string;
  ts: string;
  text: string;
  blocks?: SlackBlock[];
}): Promise<void> {
  await updateMessage(input);
}
