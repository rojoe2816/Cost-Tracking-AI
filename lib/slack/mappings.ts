import "server-only";

import { db } from "@/lib/db";
import { demoAgency } from "@/lib/demo-agency";
import { createOrUpdateSlackChannelMapping } from "@/lib/slack/attribution";

export class SlackMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlackMappingError";
  }
}

export type SlackMappingPageData = Awaited<
  ReturnType<typeof getSlackMappingPageData>
>;

export async function getDemoOrganization() {
  return db.organization.findUnique({
    where: { slug: demoAgency.slug },
    select: {
      id: true,
      name: true,
    },
  });
}

export async function getSlackMappingPageData(organizationId: string) {
  const [workspace, mappings, clients, projects, workflowTypes] =
    await Promise.all([
      db.slackWorkspace.findFirst({
        where: { organizationId },
        select: {
          id: true,
          slackTeamId: true,
          slackTeamName: true,
        },
      }),
      db.slackChannelMapping.findMany({
        where: { organizationId },
        include: {
          client: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          defaultWorkflowType: { select: { id: true, name: true } },
        },
        orderBy: { slackChannelId: "asc" },
      }),
      db.client.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.project.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: { id: true, name: true, clientId: true },
        orderBy: { name: "asc" },
      }),
      db.workflowType.findMany({
        where: { organizationId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

  return {
    workspace,
    mappings,
    clients,
    projects,
    workflowTypes,
  };
}

function validateSlackChannelId(slackChannelId: string): string {
  const trimmed = slackChannelId.trim();

  if (!trimmed) {
    throw new SlackMappingError("Slack channel ID is required");
  }

  // Manual mapping currently assumes a normal public/private channel.
  // Do not use this form for DMs or group DMs.
  if (trimmed.startsWith("D")) {
    throw new SlackMappingError(
      "Direct message channels cannot be mapped persistently",
    );
  }

  return trimmed;
}

async function getWorkspaceForOrganization(organizationId: string) {
  const workspace = await db.slackWorkspace.findFirst({
    where: { organizationId },
    select: {
      id: true,
      organizationId: true,
      slackTeamId: true,
    },
  });

  if (!workspace) {
    throw new SlackMappingError(
      "No Slack workspace connected for this organization",
    );
  }

  if (workspace.organizationId !== organizationId) {
    throw new SlackMappingError("Slack workspace does not belong to organization");
  }

  return workspace;
}

async function findOwnedMapping(input: {
  organizationId: string;
  mappingId: string;
}) {
  const mapping = await db.slackChannelMapping.findFirst({
    where: {
      id: input.mappingId,
      organizationId: input.organizationId,
    },
  });

  if (!mapping) {
    throw new SlackMappingError("Mapping not found");
  }

  return mapping;
}

export async function createManualSlackChannelMapping(input: {
  organizationId: string;
  slackChannelId: string;
  slackChannelName?: string | null;
  clientId: string;
  projectId: string;
  workflowTypeId: string;
}): Promise<void> {
  const slackChannelId = validateSlackChannelId(input.slackChannelId);
  const workspace = await getWorkspaceForOrganization(input.organizationId);

  await createOrUpdateSlackChannelMapping({
    mode: "MAP_CHANNEL",
    organizationId: input.organizationId,
    slackTeamId: workspace.slackTeamId,
    slackChannelId,
    ...(input.slackChannelName?.trim()
      ? { slackChannelName: input.slackChannelName.trim() }
      : {}),
    clientId: input.clientId,
    projectId: input.projectId,
    workflowTypeId: input.workflowTypeId,
    channelType: "channel",
  });
}

export async function updateManualSlackChannelMapping(input: {
  organizationId: string;
  mappingId: string;
  slackChannelId: string;
  slackChannelName?: string | null;
  clientId: string;
  projectId: string;
  workflowTypeId: string;
}): Promise<void> {
  const slackChannelId = validateSlackChannelId(input.slackChannelId);
  const workspace = await getWorkspaceForOrganization(input.organizationId);
  const existing = await findOwnedMapping({
    organizationId: input.organizationId,
    mappingId: input.mappingId,
  });

  if (existing.slackChannelId !== slackChannelId) {
    const conflict = await db.slackChannelMapping.findFirst({
      where: {
        slackWorkspaceId: workspace.id,
        slackChannelId,
        NOT: { id: existing.id },
      },
      select: { id: true },
    });

    if (conflict) {
      throw new SlackMappingError(
        "A mapping for this Slack channel ID already exists",
      );
    }

    await db.slackChannelMapping.delete({
      where: { id: existing.id },
    });
  }

  await createOrUpdateSlackChannelMapping({
    mode: "MAP_CHANNEL",
    organizationId: input.organizationId,
    slackTeamId: workspace.slackTeamId,
    slackChannelId,
    ...(input.slackChannelName?.trim()
      ? { slackChannelName: input.slackChannelName.trim() }
      : {}),
    clientId: input.clientId,
    projectId: input.projectId,
    workflowTypeId: input.workflowTypeId,
    channelType: "channel",
  });
}

export async function deleteManualSlackChannelMapping(input: {
  organizationId: string;
  mappingId: string;
}): Promise<void> {
  const existing = await findOwnedMapping(input);

  await db.slackChannelMapping.delete({
    where: { id: existing.id },
  });
}
