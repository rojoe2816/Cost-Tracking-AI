import "server-only";

import { env } from "@/lib/env";
import {
  classifySecret,
  combineStatuses,
  type IntegrationStatus,
} from "@/lib/integration-status";
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
};

export class SlackClientError extends Error {
  constructor(
    message: string,
    public readonly slackError?: string,
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

async function callSlackApi<T extends SlackApiResponse>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  assertSlackConfigured();

  const response = await fetch(`${SLACK_API_BASE}/${method}`, {
    method: "POST",
    headers: {
      ...createSlackAuthHeaders(),
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => null)) as T | null;

  if (!data?.ok) {
    throw new SlackClientError(
      `Slack API ${method} failed`,
      data?.error,
    );
  }

  return data;
}

export async function postSlackMessage(input: {
  channel: string;
  text: string;
  threadTs?: string;
  blocks?: SlackBlock[];
}): Promise<{ ts: string; channel: string }> {
  const data = await callSlackApi<SlackApiResponse>("chat.postMessage", {
    channel: input.channel,
    text: input.text,
    ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
    ...(input.blocks ? { blocks: input.blocks } : {}),
  });

  if (!data.ts) {
    throw new SlackClientError("Slack chat.postMessage response missing ts");
  }

  return {
    ts: data.ts,
    channel: data.channel ?? input.channel,
  };
}

export async function updateSlackMessage(input: {
  channel: string;
  ts: string;
  text: string;
  blocks?: SlackBlock[];
}): Promise<void> {
  await callSlackApi("chat.update", {
    channel: input.channel,
    ts: input.ts,
    text: input.text,
    ...(input.blocks ? { blocks: input.blocks } : {}),
  });
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
