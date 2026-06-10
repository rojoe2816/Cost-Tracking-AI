import { env } from "@/lib/env";
import {
  classifySecret,
  combineStatuses,
  type IntegrationStatus,
} from "@/lib/integration-status";

export interface SlackRuntimeConfig {
  status: IntegrationStatus;
  hasBotToken: boolean;
  hasSigningSecret: boolean;
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
