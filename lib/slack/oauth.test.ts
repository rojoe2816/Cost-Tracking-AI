import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = {
  SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID,
  SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET,
  SLACK_REDIRECT_URI: process.env.SLACK_REDIRECT_URI,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
};

describe("Slack OAuth helpers", () => {
  beforeEach(() => {
    process.env.SLACK_CLIENT_ID = "1234567890.0987654321";
    process.env.SLACK_CLIENT_SECRET = "mock-client-secret";
    process.env.SLACK_REDIRECT_URI =
      "http://localhost:3000/api/slack/oauth/callback";
    process.env.ENCRYPTION_KEY = "test-only-encryption-key-32-chars!!";
    vi.resetModules();
  });

  afterEach(() => {
    process.env.SLACK_CLIENT_ID = originalEnv.SLACK_CLIENT_ID;
    process.env.SLACK_CLIENT_SECRET = originalEnv.SLACK_CLIENT_SECRET;
    process.env.SLACK_REDIRECT_URI = originalEnv.SLACK_REDIRECT_URI;
    process.env.ENCRYPTION_KEY = originalEnv.ENCRYPTION_KEY;
    vi.unstubAllGlobals();
  });

  it("builds install URL with required scopes and state", async () => {
    const { buildSlackInstallUrl, createSlackOAuthState, SLACK_OAUTH_SCOPES } =
      await import("@/lib/slack/oauth");

    const state = createSlackOAuthState("org_demo");
    const url = new URL(buildSlackInstallUrl(state));

    expect(url.hostname).toBe("slack.com");
    expect(url.pathname).toBe("/oauth/v2/authorize");
    expect(url.searchParams.get("client_id")).toBe("1234567890.0987654321");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/slack/oauth/callback",
    );
    expect(url.searchParams.get("state")).toBe(state);
    expect(url.searchParams.get("scope")).toBe(SLACK_OAUTH_SCOPES.join(","));
  });

  it("verifies signed OAuth state", async () => {
    const { createSlackOAuthState, verifySlackOAuthState } = await import(
      "@/lib/slack/oauth"
    );

    const state = createSlackOAuthState("org_demo");

    expect(verifySlackOAuthState(state)).toEqual({
      organizationId: "org_demo",
    });
    expect(verifySlackOAuthState("invalid-state")).toBeNull();
  });

  it("exchanges OAuth code without logging token values", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        access_token: "xoxb-secret-token",
        scope: "chat:write,app_mentions:read",
        bot_user_id: "U_BOT",
        team: { id: "T_TEST", name: "Pilot Workspace" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { exchangeSlackOAuthCode } = await import("@/lib/slack/oauth");
    const result = await exchangeSlackOAuthCode("oauth-code-123");

    expect(result).toEqual({
      accessToken: "xoxb-secret-token",
      teamId: "T_TEST",
      teamName: "Pilot Workspace",
      botUserId: "U_BOT",
      scope: "chat:write,app_mentions:read",
    });

    const requestBody = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(requestBody.get("code")).toBe("oauth-code-123");
    expect(requestBody.get("client_id")).toBe("1234567890.0987654321");
    expect(result.accessToken).toBe("xoxb-secret-token");
  });
});
