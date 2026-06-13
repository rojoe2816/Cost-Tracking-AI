import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
  },
  slackWorkspace: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  slackChannelMapping: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
  client: {
    findMany: vi.fn(),
  },
  project: {
    findMany: vi.fn(),
  },
  workflowType: {
    findMany: vi.fn(),
  },
}));

const mockCreateOrUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/slack/attribution", () => ({
  createOrUpdateSlackChannelMapping: mockCreateOrUpdate,
}));

import {
  createManualSlackChannelMapping,
  deleteManualSlackChannelMapping,
  getSlackMappingPageData,
  SlackMappingError,
  updateManualSlackChannelMapping,
} from "./mappings";

const ORG_ID = "org_demo";
const WORKSPACE_ID = "ws_demo";
const TEAM_ID = "T_DEMO";
const MAPPING_ID = "map_acme";
const CLIENT_ID = "client_acme";
const PROJECT_ID = "project_seo";
const WORKFLOW_ID = "workflow_client_update";
const NOW = new Date("2026-06-12T12:00:00.000Z");

describe("getSlackMappingPageData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the seeded C_ACME mapping with related attribution metadata", async () => {
    mockDb.slackWorkspace.findMany.mockResolvedValue([
      {
        id: WORKSPACE_ID,
        slackTeamId: TEAM_ID,
        slackTeamName: "Demo Slack Workspace",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);
    mockDb.slackChannelMapping.findMany.mockResolvedValue([
      {
        id: MAPPING_ID,
        slackChannelId: "C_ACME",
        slackChannelName: "client-acme-seo",
        clientId: CLIENT_ID,
        projectId: PROJECT_ID,
        defaultWorkflowTypeId: WORKFLOW_ID,
        createdAt: NOW,
        updatedAt: NOW,
        slackWorkspace: {
          id: WORKSPACE_ID,
          slackTeamId: TEAM_ID,
          slackTeamName: "Demo Slack Workspace",
        },
        client: { id: CLIENT_ID, name: "Acme Dental" },
        project: { id: PROJECT_ID, name: "SEO Retainer" },
        defaultWorkflowType: { id: WORKFLOW_ID, name: "Client Update" },
      },
    ]);
    mockDb.client.findMany.mockResolvedValue([
      { id: CLIENT_ID, name: "Acme Dental" },
    ]);
    mockDb.project.findMany.mockResolvedValue([
      { id: PROJECT_ID, name: "SEO Retainer", clientId: CLIENT_ID },
    ]);
    mockDb.workflowType.findMany.mockResolvedValue([
      { id: WORKFLOW_ID, name: "Client Update" },
    ]);

    await expect(getSlackMappingPageData(ORG_ID)).resolves.toEqual({
      workspace: {
        id: WORKSPACE_ID,
        slackTeamId: TEAM_ID,
        slackTeamName: "Demo Slack Workspace",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
      workspaces: [
        {
          id: WORKSPACE_ID,
          slackTeamId: TEAM_ID,
          slackTeamName: "Demo Slack Workspace",
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        },
      ],
      mappings: [
        expect.objectContaining({
          slackChannelId: "C_ACME",
          slackChannelName: "client-acme-seo",
          slackWorkspace: {
            id: WORKSPACE_ID,
            slackTeamId: TEAM_ID,
            slackTeamName: "Demo Slack Workspace",
          },
          client: { id: CLIENT_ID, name: "Acme Dental" },
          project: { id: PROJECT_ID, name: "SEO Retainer" },
          defaultWorkflowType: { id: WORKFLOW_ID, name: "Client Update" },
        }),
      ],
      clients: [{ id: CLIENT_ID, name: "Acme Dental" }],
      projects: [
        { id: PROJECT_ID, name: "SEO Retainer", clientId: CLIENT_ID },
      ],
      workflowTypes: [{ id: WORKFLOW_ID, name: "Client Update" }],
    });
  });

  it("does not include C_UNMAPPED unless a mapping row exists", async () => {
    mockDb.slackWorkspace.findMany.mockResolvedValue([
      {
        id: WORKSPACE_ID,
        slackTeamId: TEAM_ID,
        slackTeamName: "Demo Slack Workspace",
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);
    mockDb.slackChannelMapping.findMany.mockResolvedValue([
      {
        id: MAPPING_ID,
        slackChannelId: "C_ACME",
        slackChannelName: "client-acme-seo",
        clientId: CLIENT_ID,
        projectId: PROJECT_ID,
        defaultWorkflowTypeId: WORKFLOW_ID,
        createdAt: NOW,
        updatedAt: NOW,
        slackWorkspace: {
          id: WORKSPACE_ID,
          slackTeamId: TEAM_ID,
          slackTeamName: "Demo Slack Workspace",
        },
        client: { id: CLIENT_ID, name: "Acme Dental" },
        project: { id: PROJECT_ID, name: "SEO Retainer" },
        defaultWorkflowType: { id: WORKFLOW_ID, name: "Client Update" },
      },
    ]);
    mockDb.client.findMany.mockResolvedValue([]);
    mockDb.project.findMany.mockResolvedValue([]);
    mockDb.workflowType.findMany.mockResolvedValue([]);

    const data = await getSlackMappingPageData(ORG_ID);

    expect(
      data.mappings.some((mapping) => mapping.slackChannelId === "C_UNMAPPED"),
    ).toBe(false);
  });
});

describe("createManualSlackChannelMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.slackWorkspace.findFirst.mockResolvedValue({
      id: WORKSPACE_ID,
      organizationId: ORG_ID,
      slackTeamId: TEAM_ID,
    });
    mockCreateOrUpdate.mockResolvedValue({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      projectId: PROJECT_ID,
      workflowTypeId: WORKFLOW_ID,
      mappingStatus: "MAPPED",
    });
  });

  it("requires a Slack channel ID", async () => {
    await expect(
      createManualSlackChannelMapping({
        organizationId: ORG_ID,
        slackChannelId: "   ",
        clientId: CLIENT_ID,
        projectId: PROJECT_ID,
        workflowTypeId: WORKFLOW_ID,
      }),
    ).rejects.toThrow(SlackMappingError);

    expect(mockCreateOrUpdate).not.toHaveBeenCalled();
  });

  it("creates a mapping through MAP_CHANNEL helper without prompt text", async () => {
    await createManualSlackChannelMapping({
      organizationId: ORG_ID,
      slackChannelId: "C_TEST",
      slackChannelName: "test-client-channel",
      clientId: CLIENT_ID,
      projectId: PROJECT_ID,
      workflowTypeId: WORKFLOW_ID,
    });

    expect(mockCreateOrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "MAP_CHANNEL",
        organizationId: ORG_ID,
        slackTeamId: TEAM_ID,
        slackChannelId: "C_TEST",
        slackChannelName: "test-client-channel",
        clientId: CLIENT_ID,
        projectId: PROJECT_ID,
        workflowTypeId: WORKFLOW_ID,
        channelType: "channel",
      }),
    );

    expect(JSON.stringify(mockCreateOrUpdate.mock.calls)).not.toMatch(/prompt|response/i);
  });

  it("rejects cross-organization ownership errors from attribution helper", async () => {
    mockCreateOrUpdate.mockRejectedValue(
      new Error("Client does not belong to organization"),
    );

    await expect(
      createManualSlackChannelMapping({
        organizationId: ORG_ID,
        slackChannelId: "C_TEST",
        clientId: "client_other_org",
        projectId: PROJECT_ID,
        workflowTypeId: WORKFLOW_ID,
      }),
    ).rejects.toThrow("Client does not belong to organization");
  });
});

describe("updateManualSlackChannelMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.slackWorkspace.findFirst.mockResolvedValue({
      id: WORKSPACE_ID,
      organizationId: ORG_ID,
      slackTeamId: TEAM_ID,
    });
    mockDb.slackChannelMapping.findFirst.mockResolvedValue({
      id: MAPPING_ID,
      organizationId: ORG_ID,
      slackWorkspaceId: WORKSPACE_ID,
      slackChannelId: "C_ACME",
    });
    mockCreateOrUpdate.mockResolvedValue({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      projectId: PROJECT_ID,
      workflowTypeId: WORKFLOW_ID,
      mappingStatus: "MAPPED",
    });
  });

  it("updates client, project, and workflow fields through MAP_CHANNEL helper", async () => {
    await updateManualSlackChannelMapping({
      organizationId: ORG_ID,
      mappingId: MAPPING_ID,
      slackChannelId: "C_ACME",
      slackChannelName: "client-acme-seo-updated",
      clientId: CLIENT_ID,
      projectId: PROJECT_ID,
      workflowTypeId: WORKFLOW_ID,
    });

    expect(mockCreateOrUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        slackChannelId: "C_ACME",
        slackChannelName: "client-acme-seo-updated",
        clientId: CLIENT_ID,
        projectId: PROJECT_ID,
        workflowTypeId: WORKFLOW_ID,
      }),
    );
  });
});

describe("deleteManualSlackChannelMapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes only the selected mapping for the organization", async () => {
    mockDb.slackChannelMapping.findFirst.mockResolvedValue({
      id: MAPPING_ID,
      organizationId: ORG_ID,
    });
    mockDb.slackChannelMapping.delete.mockResolvedValue({ id: MAPPING_ID });

    await deleteManualSlackChannelMapping({
      organizationId: ORG_ID,
      mappingId: MAPPING_ID,
    });

    expect(mockDb.slackChannelMapping.findFirst).toHaveBeenCalledWith({
      where: {
        id: MAPPING_ID,
        organizationId: ORG_ID,
      },
    });
    expect(mockDb.slackChannelMapping.delete).toHaveBeenCalledWith({
      where: { id: MAPPING_ID },
    });
  });
});
