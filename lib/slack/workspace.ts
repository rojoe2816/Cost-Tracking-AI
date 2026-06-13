import "server-only";

import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/security/encryption";
import type { SlackOAuthAccessResult } from "@/lib/slack/oauth";

export async function upsertSlackWorkspaceFromOAuth(
  organizationId: string,
  oauth: SlackOAuthAccessResult,
) {
  const encryptedBotToken = encryptSecret(oauth.accessToken);
  const now = new Date();

  return db.slackWorkspace.upsert({
    where: {
      slackTeamId: oauth.teamId,
    },
    update: {
      organizationId,
      slackTeamName: oauth.teamName,
      botUserId: oauth.botUserId,
      encryptedBotToken,
      connectedAt: now,
      disconnectedAt: null,
    },
    create: {
      organizationId,
      slackTeamId: oauth.teamId,
      slackTeamName: oauth.teamName,
      botUserId: oauth.botUserId,
      encryptedBotToken,
      connectedAt: now,
    },
    select: {
      id: true,
      organizationId: true,
      slackTeamId: true,
      slackTeamName: true,
      botUserId: true,
      connectedAt: true,
    },
  });
}

export async function disconnectSlackWorkspace(organizationId: string): Promise<void> {
  await db.slackWorkspace.updateMany({
    where: { organizationId },
    data: {
      encryptedBotToken: null,
      botUserId: null,
      disconnectedAt: new Date(),
    },
  });
}

export async function getEncryptedWorkspaceBotToken(
  slackTeamId: string,
): Promise<string | null> {
  const workspace = await db.slackWorkspace.findUnique({
    where: { slackTeamId },
    select: { encryptedBotToken: true },
  });

  return workspace?.encryptedBotToken ?? null;
}
