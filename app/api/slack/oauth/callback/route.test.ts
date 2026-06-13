import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVerifySlackOAuthState = vi.hoisted(() =>
  vi.fn().mockReturnValue({ organizationId: "org_demo" }),
);
const mockExchangeSlackOAuthCode = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    accessToken: "xoxb-secret-token",
    teamId: "T_TEST",
    teamName: "Pilot Workspace",
    botUserId: "U_BOT",
    scope: "chat:write",
  }),
);
const mockUpsertSlackWorkspaceFromOAuth = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    organizationId: "org_demo",
    slackTeamId: "T_TEST",
    slackTeamName: "Pilot Workspace",
    botUserId: "U_BOT",
  }),
);
const mockIsSlackOAuthConfigured = vi.hoisted(() => vi.fn().mockReturnValue(true));
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/slack/oauth", () => ({
  exchangeSlackOAuthCode: mockExchangeSlackOAuthCode,
  isSlackOAuthConfigured: mockIsSlackOAuthConfigured,
  verifySlackOAuthState: mockVerifySlackOAuthState,
}));

vi.mock("@/lib/slack/workspace", () => ({
  upsertSlackWorkspaceFromOAuth: mockUpsertSlackWorkspaceFromOAuth,
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { GET } from "./route";

describe("GET /api/slack/oauth/callback", () => {
  beforeEach(() => {
    mockIsSlackOAuthConfigured.mockClear();
    mockVerifySlackOAuthState.mockClear();
    mockExchangeSlackOAuthCode.mockClear();
    mockUpsertSlackWorkspaceFromOAuth.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    mockIsSlackOAuthConfigured.mockReturnValue(true);
    mockVerifySlackOAuthState.mockReturnValue({ organizationId: "org_demo" });
    mockExchangeSlackOAuthCode.mockResolvedValue({
      accessToken: "xoxb-secret-token",
      teamId: "T_TEST",
      teamName: "Pilot Workspace",
      botUserId: "U_BOT",
      scope: "chat:write",
    });
    mockUpsertSlackWorkspaceFromOAuth.mockResolvedValue({
      organizationId: "org_demo",
      slackTeamId: "T_TEST",
      slackTeamName: "Pilot Workspace",
      botUserId: "U_BOT",
    });
  });

  it("rejects missing code", async () => {
    await expect(
      GET(new Request("http://localhost:3000/api/slack/oauth/callback?state=abc")),
    ).rejects.toThrow("REDIRECT:/slack?error=Missing%20Slack%20OAuth%20callback%20parameters");
  });

  it("rejects invalid state", async () => {
    mockVerifySlackOAuthState.mockReturnValueOnce(null);

    await expect(
      GET(
        new Request(
          "http://localhost:3000/api/slack/oauth/callback?code=abc&state=bad",
        ),
      ),
    ).rejects.toThrow("REDIRECT:/slack?error=Invalid%20Slack%20OAuth%20state");
  });

  it("creates workspace on successful OAuth callback", async () => {
    await expect(
      GET(
        new Request(
          "http://localhost:3000/api/slack/oauth/callback?code=oauth-code&state=signed-state",
        ),
      ),
    ).rejects.toThrow("REDIRECT:/slack?notice=slack-connected");

    expect(mockExchangeSlackOAuthCode).toHaveBeenCalledWith("oauth-code");
    expect(mockUpsertSlackWorkspaceFromOAuth).toHaveBeenCalledWith(
      "org_demo",
      expect.objectContaining({
        accessToken: "xoxb-secret-token",
        teamId: "T_TEST",
      }),
    );
    expect(mockLogger.error).not.toHaveBeenCalled();

    const loggedPayload = JSON.stringify(mockLogger.info.mock.calls);
    expect(loggedPayload).not.toContain("xoxb-secret-token");
    expect(loggedPayload).not.toContain("oauth-code");
  });

  it("handles Slack OAuth error safely", async () => {
    await expect(
      GET(
        new Request(
          "http://localhost:3000/api/slack/oauth/callback?error=access_denied",
        ),
      ),
    ).rejects.toThrow(
      "REDIRECT:/slack?error=Slack%20install%20was%20canceled%20or%20denied",
    );
  });
});
