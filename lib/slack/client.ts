import { env } from "@/lib/env";

export interface SlackRuntimeConfig {
  enabled: boolean;
  hasBotToken: boolean;
  hasSigningSecret: boolean;
}

export function getSlackRuntimeConfig(): SlackRuntimeConfig {
  const hasBotToken = Boolean(env.SLACK_BOT_TOKEN);
  const hasSigningSecret = Boolean(env.SLACK_SIGNING_SECRET);

  return {
    enabled: hasBotToken && hasSigningSecret,
    hasBotToken,
    hasSigningSecret,
  };
}

export function createSlackAuthHeaders() {
  if (!env.SLACK_BOT_TOKEN) {
    return {};
  }

  return {
    Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
  };
}
