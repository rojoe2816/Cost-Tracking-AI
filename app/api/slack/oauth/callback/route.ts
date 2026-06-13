import { redirect } from "next/navigation";

import { logger } from "@/lib/logger";
import {
  exchangeSlackOAuthCode,
  isSlackOAuthConfigured,
  verifySlackOAuthState,
} from "@/lib/slack/oauth";
import { upsertSlackWorkspaceFromOAuth } from "@/lib/slack/workspace";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Slack OAuth callback. Exchanges the authorization code for a bot token and
 * stores the encrypted token on SlackWorkspace.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (oauthError) {
    logger.warn(
      {
        route: "/api/slack/oauth/callback",
        oauthError,
      },
      "Slack OAuth install was denied or failed",
    );
    redirect(`/slack?error=${encodeURIComponent("Slack install was canceled or denied")}`);
  }

  if (!isSlackOAuthConfigured()) {
    redirect("/slack?error=Slack%20OAuth%20is%20not%20configured");
  }

  if (!code || !state) {
    redirect("/slack?error=Missing%20Slack%20OAuth%20callback%20parameters");
  }

  const verifiedState = verifySlackOAuthState(state);

  if (!verifiedState) {
    logger.warn(
      { route: "/api/slack/oauth/callback" },
      "Rejected Slack OAuth callback with invalid state",
    );
    redirect("/slack?error=Invalid%20Slack%20OAuth%20state");
  }

  try {
    const oauthResult = await exchangeSlackOAuthCode(code);
    const workspace = await upsertSlackWorkspaceFromOAuth(
      verifiedState.organizationId,
      oauthResult,
    );

    logger.info(
      {
        route: "/api/slack/oauth/callback",
        organizationId: workspace.organizationId,
        slackTeamId: workspace.slackTeamId,
        slackTeamName: workspace.slackTeamName,
        hasBotUserId: Boolean(workspace.botUserId),
      },
      "Slack workspace connected via OAuth",
    );
  } catch (error) {
    logger.error(
      {
        err: error instanceof Error ? error.message : String(error),
        route: "/api/slack/oauth/callback",
        organizationId: verifiedState.organizationId,
      },
      "Slack OAuth callback failed",
    );
    redirect("/slack?error=Slack%20OAuth%20install%20failed");
  }

  redirect("/slack?notice=slack-connected");
}
