import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  slackWorkspace: {
    findUnique: vi.fn(),
  },
  slackChannelMapping: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
  },
  client: {
    findFirst: vi.fn(),
  },
  project: {
    findFirst: vi.fn(),
  },
  workflowType: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  createOrUpdateSlackChannelMapping,
  resolveSlackAttribution,
} from "./attribution";

const ORG_ID = "org_1";
const WORKSPACE_ID = "ws_1";
const TEAM_ID = "T_TEST";
const CHANNEL_ID = "C_TEST";
const CLIENT_ID = "client_1";
const PROJECT_ID = "project_1";
const WORKFLOW_ID = "workflow_1";

describe("resolveSlackAttribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns UNKNOWN_WORKSPACE when the Slack workspace is missing", async () => {
    mockDb.slackWorkspace.findUnique.mockResolvedValue(null);

    await expect(
      resolveSlackAttribution({
        slackTeamId: TEAM_ID,
        slackChannelId: CHANNEL_ID,
      }),
    ).resolves.toEqual({
      organizationId: null,
      clientId: null,
      projectId: null,
      workflowTypeId: null,
      mappingStatus: "UNKNOWN_WORKSPACE",
    });
  });

  it("returns UNMAPPED when the workspace exists but the channel is not mapped", async () => {
    mockDb.slackWorkspace.findUnique.mockResolvedValue({
      id: WORKSPACE_ID,
      organizationId: ORG_ID,
      slackTeamId: TEAM_ID,
    });
    mockDb.slackChannelMapping.findFirst.mockResolvedValue(null);

    await expect(
      resolveSlackAttribution({
        slackTeamId: TEAM_ID,
        slackChannelId: CHANNEL_ID,
      }),
    ).resolves.toEqual({
      organizationId: ORG_ID,
      clientId: null,
      projectId: null,
      workflowTypeId: null,
      mappingStatus: "UNMAPPED",
    });
  });

  it("returns MAPPED when an existing mapping includes a client", async () => {
    mockDb.slackWorkspace.findUnique.mockResolvedValue({
      id: WORKSPACE_ID,
      organizationId: ORG_ID,
      slackTeamId: TEAM_ID,
    });
    mockDb.slackChannelMapping.findFirst.mockResolvedValue({
      clientId: CLIENT_ID,
      projectId: PROJECT_ID,
      defaultWorkflowTypeId: WORKFLOW_ID,
    });

    await expect(
      resolveSlackAttribution({
        slackTeamId: TEAM_ID,
        slackChannelId: CHANNEL_ID,
      }),
    ).resolves.toEqual({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      projectId: PROJECT_ID,
      workflowTypeId: WORKFLOW_ID,
      mappingStatus: "MAPPED",
    });
  });
});

describe("createOrUpdateSlackChannelMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.client.findFirst.mockResolvedValue({ id: CLIENT_ID });
    mockDb.project.findFirst.mockResolvedValue({ id: PROJECT_ID });
    mockDb.workflowType.findFirst.mockResolvedValue({ id: WORKFLOW_ID });
  });

  it("ASSIGN_ONCE does not persist a mapping", async () => {
    const result = await createOrUpdateSlackChannelMapping({
      mode: "ASSIGN_ONCE",
      organizationId: ORG_ID,
      slackTeamId: TEAM_ID,
      slackChannelId: CHANNEL_ID,
      clientId: CLIENT_ID,
      projectId: PROJECT_ID,
      workflowTypeId: WORKFLOW_ID,
    });

    expect(result).toEqual({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      projectId: PROJECT_ID,
      workflowTypeId: WORKFLOW_ID,
      mappingStatus: "MAPPED",
    });
    expect(mockDb.slackChannelMapping.upsert).not.toHaveBeenCalled();
    expect(mockDb.slackWorkspace.findUnique).not.toHaveBeenCalled();
  });

  it("MAP_CHANNEL persists or updates a channel mapping", async () => {
    mockDb.slackWorkspace.findUnique.mockResolvedValue({
      id: WORKSPACE_ID,
      organizationId: ORG_ID,
      slackTeamId: TEAM_ID,
    });
    mockDb.slackChannelMapping.upsert.mockResolvedValue({
      clientId: CLIENT_ID,
      projectId: PROJECT_ID,
      defaultWorkflowTypeId: WORKFLOW_ID,
    });

    const result = await createOrUpdateSlackChannelMapping({
      mode: "MAP_CHANNEL",
      organizationId: ORG_ID,
      slackTeamId: TEAM_ID,
      slackChannelId: CHANNEL_ID,
      slackChannelName: "#acme-general",
      clientId: CLIENT_ID,
      projectId: PROJECT_ID,
      workflowTypeId: WORKFLOW_ID,
      channelType: "channel",
    });

    expect(result.mappingStatus).toBe("MAPPED");
    expect(mockDb.slackChannelMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slackWorkspaceId_slackChannelId: {
            slackWorkspaceId: WORKSPACE_ID,
            slackChannelId: CHANNEL_ID,
          },
        },
      }),
    );
  });

  it("MAP_CHANNEL does not persist mapping for im", async () => {
    mockDb.slackWorkspace.findUnique.mockResolvedValue({
      id: WORKSPACE_ID,
      organizationId: ORG_ID,
      slackTeamId: TEAM_ID,
    });

    const result = await createOrUpdateSlackChannelMapping({
      mode: "MAP_CHANNEL",
      organizationId: ORG_ID,
      slackTeamId: TEAM_ID,
      slackChannelId: "D_TEST",
      clientId: CLIENT_ID,
      channelType: "im",
    });

    expect(result).toEqual({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      projectId: null,
      workflowTypeId: null,
      mappingStatus: "MAPPED",
    });
    expect(mockDb.slackChannelMapping.upsert).not.toHaveBeenCalled();
  });

  it("MAP_CHANNEL does not persist mapping for mpim", async () => {
    mockDb.slackWorkspace.findUnique.mockResolvedValue({
      id: WORKSPACE_ID,
      organizationId: ORG_ID,
      slackTeamId: TEAM_ID,
    });

    const result = await createOrUpdateSlackChannelMapping({
      mode: "MAP_CHANNEL",
      organizationId: ORG_ID,
      slackTeamId: TEAM_ID,
      slackChannelId: "G_TEST",
      clientId: CLIENT_ID,
      channelType: "mpim",
    });

    expect(result.mappingStatus).toBe("MAPPED");
    expect(mockDb.slackChannelMapping.upsert).not.toHaveBeenCalled();
  });

  it("rejects cross-organization client IDs", async () => {
    mockDb.slackWorkspace.findUnique.mockResolvedValue({
      id: WORKSPACE_ID,
      organizationId: ORG_ID,
      slackTeamId: TEAM_ID,
    });
    mockDb.client.findFirst.mockResolvedValue(null);

    await expect(
      createOrUpdateSlackChannelMapping({
        mode: "MAP_CHANNEL",
        organizationId: ORG_ID,
        slackTeamId: TEAM_ID,
        slackChannelId: CHANNEL_ID,
        clientId: "foreign-client",
        channelType: "channel",
      }),
    ).rejects.toThrow("Client does not belong to organization");
  });

  it("rejects cross-organization project IDs", async () => {
    mockDb.slackWorkspace.findUnique.mockResolvedValue({
      id: WORKSPACE_ID,
      organizationId: ORG_ID,
      slackTeamId: TEAM_ID,
    });
    mockDb.project.findFirst.mockResolvedValue(null);

    await expect(
      createOrUpdateSlackChannelMapping({
        mode: "MAP_CHANNEL",
        organizationId: ORG_ID,
        slackTeamId: TEAM_ID,
        slackChannelId: CHANNEL_ID,
        clientId: CLIENT_ID,
        projectId: "foreign-project",
        channelType: "channel",
      }),
    ).rejects.toThrow("Project does not belong to organization");
  });

  it("rejects cross-organization workflow type IDs", async () => {
    mockDb.slackWorkspace.findUnique.mockResolvedValue({
      id: WORKSPACE_ID,
      organizationId: ORG_ID,
      slackTeamId: TEAM_ID,
    });
    mockDb.workflowType.findFirst.mockResolvedValue(null);

    await expect(
      createOrUpdateSlackChannelMapping({
        mode: "MAP_CHANNEL",
        organizationId: ORG_ID,
        slackTeamId: TEAM_ID,
        slackChannelId: CHANNEL_ID,
        clientId: CLIENT_ID,
        workflowTypeId: "foreign-workflow",
        channelType: "channel",
      }),
    ).rejects.toThrow("Workflow type does not belong to organization");
  });
});
