import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  slackWorkspace: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

const mockEncryptSecret = vi.hoisted(() =>
  vi.fn((value: string) => `encrypted:${value}`),
);

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/security/encryption", () => ({
  encryptSecret: mockEncryptSecret,
}));

import {
  disconnectSlackWorkspace,
  upsertSlackWorkspaceFromOAuth,
} from "./workspace";

describe("Slack workspace OAuth persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.slackWorkspace.upsert.mockResolvedValue({
      id: "ws_1",
      organizationId: "org_demo",
      slackTeamId: "T_TEST",
      slackTeamName: "Pilot Workspace",
      botUserId: "U_BOT",
      connectedAt: new Date("2026-06-09T12:00:00.000Z"),
    });
    mockDb.slackWorkspace.updateMany.mockResolvedValue({ count: 1 });
  });

  it("stores encrypted bot tokens on OAuth success", async () => {
    await upsertSlackWorkspaceFromOAuth("org_demo", {
      accessToken: "xoxb-secret-token",
      teamId: "T_TEST",
      teamName: "Pilot Workspace",
      botUserId: "U_BOT",
      scope: "chat:write",
    });

    expect(mockEncryptSecret).toHaveBeenCalledWith("xoxb-secret-token");
    expect(mockDb.slackWorkspace.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slackTeamId: "T_TEST" },
        update: expect.objectContaining({
          organizationId: "org_demo",
          encryptedBotToken: "encrypted:xoxb-secret-token",
          botUserId: "U_BOT",
          disconnectedAt: null,
        }),
        create: expect.objectContaining({
          encryptedBotToken: "encrypted:xoxb-secret-token",
        }),
      }),
    );
  });

  it("disconnect clears token without deleting workspace history", async () => {
    await disconnectSlackWorkspace("org_demo");

    expect(mockDb.slackWorkspace.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org_demo" },
      data: {
        encryptedBotToken: null,
        botUserId: null,
        disconnectedAt: expect.any(Date),
      },
    });
  });
});
