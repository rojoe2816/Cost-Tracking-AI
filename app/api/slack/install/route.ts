import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { logger } from "@/lib/logger";
import {
  buildSlackInstallUrl,
  createSlackOAuthState,
  isSlackOAuthConfigured,
} from "@/lib/slack/oauth";
import { getDemoOrganization } from "@/lib/slack/mappings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Starts the Slack OAuth install flow for the current organization.
 */
export async function GET() {
  if (!isSlackOAuthConfigured()) {
    logger.warn({ route: "/api/slack/install" }, "Slack OAuth is not configured");
    redirect("/slack?error=Slack%20OAuth%20is%20not%20configured");
  }

  const organization = await getDemoOrganization();

  if (!organization) {
    redirect("/slack?error=Organization%20not%20found");
  }

  const state = createSlackOAuthState(organization.id);
  const installUrl = buildSlackInstallUrl(state);

  logger.info(
    {
      route: "/api/slack/install",
      organizationId: organization.id,
    },
    "Redirecting to Slack OAuth install URL",
  );

  return NextResponse.redirect(installUrl);
}
