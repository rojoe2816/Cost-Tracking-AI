import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

const STATE_TTL_MS = 15 * 60 * 1000;

export const SLACK_OAUTH_SCOPES = [
  "chat:write",
  "app_mentions:read",
  "channels:history",
  "channels:read",
] as const;

type SlackOAuthStatePayload = {
  organizationId: string;
  nonce: string;
  issuedAt: number;
};

export function isSlackOAuthConfigured(): boolean {
  return Boolean(
    env.SLACK_CLIENT_ID &&
      env.SLACK_CLIENT_SECRET &&
      env.SLACK_REDIRECT_URI,
  );
}

export function assertSlackOAuthConfigured(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET || !env.SLACK_REDIRECT_URI) {
    throw new Error(
      "Slack OAuth is not configured. Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_REDIRECT_URI in .env.",
    );
  }

  return {
    clientId: env.SLACK_CLIENT_ID,
    clientSecret: env.SLACK_CLIENT_SECRET,
    redirectUri: env.SLACK_REDIRECT_URI,
  };
}

export function createSlackOAuthState(organizationId: string): string {
  const payload: SlackOAuthStatePayload = {
    organizationId,
    nonce: randomBytes(16).toString("hex"),
    issuedAt: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signState(encoded);

  return `${encoded}.${signature}`;
}

export function verifySlackOAuthState(
  state: string,
): { organizationId: string } | null {
  const [encoded, signature] = state.split(".");

  if (!encoded || !signature) {
    return null;
  }

  const expectedSignature = signState(encoded);

  try {
    const signatureMatches = timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );

    if (!signatureMatches) {
      return null;
    }
  } catch {
    return null;
  }

  let payload: SlackOAuthStatePayload;

  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as SlackOAuthStatePayload;
  } catch {
    return null;
  }

  if (
    !payload.organizationId ||
    typeof payload.issuedAt !== "number" ||
    Date.now() - payload.issuedAt > STATE_TTL_MS
  ) {
    return null;
  }

  return { organizationId: payload.organizationId };
}

export function buildSlackInstallUrl(state: string): string {
  const { clientId, redirectUri } = assertSlackOAuthConfigured();
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SLACK_OAUTH_SCOPES.join(","),
    redirect_uri: redirectUri,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export type SlackOAuthAccessResult = {
  accessToken: string;
  teamId: string;
  teamName: string | null;
  botUserId: string | null;
  scope: string | null;
};

type SlackOAuthAccessResponse = {
  ok: boolean;
  error?: string;
  access_token?: string;
  scope?: string;
  bot_user_id?: string;
  team?: {
    id?: string;
    name?: string;
  };
};

export async function exchangeSlackOAuthCode(
  code: string,
): Promise<SlackOAuthAccessResult> {
  const { clientId, clientSecret, redirectUri } = assertSlackOAuthConfigured();

  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack OAuth token exchange failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as SlackOAuthAccessResponse;

  if (!data.ok || !data.access_token || !data.team?.id) {
    throw new Error(data.error ?? "Slack OAuth token exchange failed");
  }

  return {
    accessToken: data.access_token,
    teamId: data.team.id,
    teamName: data.team.name ?? null,
    botUserId: data.bot_user_id ?? null,
    scope: data.scope ?? null,
  };
}

function signState(encodedPayload: string): string {
  return createHmac("sha256", env.ENCRYPTION_KEY)
    .update(encodedPayload)
    .digest("base64url");
}
