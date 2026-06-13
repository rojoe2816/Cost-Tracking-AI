import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetDemoOrganization = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: "org_demo", name: "Demo Agency" }),
);
const mockBuildSlackInstallUrl = vi.hoisted(() =>
  vi.fn((state: string) => `https://slack.com/oauth/v2/authorize?state=${state}`),
);
const mockCreateSlackOAuthState = vi.hoisted(() =>
  vi.fn().mockReturnValue("signed-state"),
);
const mockIsSlackOAuthConfigured = vi.hoisted(() => vi.fn().mockReturnValue(true));
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/slack/mappings", () => ({
  getDemoOrganization: mockGetDemoOrganization,
}));

vi.mock("@/lib/slack/oauth", () => ({
  buildSlackInstallUrl: mockBuildSlackInstallUrl,
  createSlackOAuthState: mockCreateSlackOAuthState,
  isSlackOAuthConfigured: mockIsSlackOAuthConfigured,
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

describe("GET /api/slack/install", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to Slack OAuth URL with signed state", async () => {
    const response = await GET();

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://slack.com/oauth/v2/authorize?state=signed-state",
    );
    expect(mockCreateSlackOAuthState).toHaveBeenCalledWith("org_demo");
    expect(mockBuildSlackInstallUrl).toHaveBeenCalledWith("signed-state");
  });

  it("redirects with error when OAuth is not configured", async () => {
    mockIsSlackOAuthConfigured.mockReturnValueOnce(false);

    await expect(GET()).rejects.toThrow(
      "REDIRECT:/slack?error=Slack%20OAuth%20is%20not%20configured",
    );
  });
});
