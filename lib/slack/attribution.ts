import "server-only";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export type SlackMappingStatus = "MAPPED" | "UNMAPPED" | "UNKNOWN_WORKSPACE";

export type SlackAttribution = {
  organizationId: string | null;
  clientId: string | null;
  projectId: string | null;
  workflowTypeId: string | null;
  mappingStatus: SlackMappingStatus;
};

export type SlackChannelMappingMode = "ASSIGN_ONCE" | "MAP_CHANNEL";

/**
 * Resolves Slack team + channel to organization/client/project/workflow attribution.
 *
 * Never throws for unknown workspaces or unmapped channels — callers receive a
 * structured `mappingStatus` instead.
 */
export async function resolveSlackAttribution(input: {
  slackTeamId: string;
  slackChannelId: string;
}): Promise<SlackAttribution> {
  const workspace = await db.slackWorkspace.findUnique({
    where: {
      slackTeamId: input.slackTeamId,
    },
  });

  if (!workspace) {
    return {
      organizationId: null,
      clientId: null,
      projectId: null,
      workflowTypeId: null,
      mappingStatus: "UNKNOWN_WORKSPACE",
    };
  }

  const mapping = await db.slackChannelMapping.findFirst({
    where: {
      organizationId: workspace.organizationId,
      slackWorkspaceId: workspace.id,
      slackChannelId: input.slackChannelId,
    },
  });

  if (!mapping?.clientId) {
    return {
      organizationId: workspace.organizationId,
      clientId: null,
      projectId: null,
      workflowTypeId: null,
      mappingStatus: "UNMAPPED",
    };
  }

  return {
    organizationId: workspace.organizationId,
    clientId: mapping.clientId,
    projectId: mapping.projectId,
    workflowTypeId: mapping.defaultWorkflowTypeId,
    mappingStatus: "MAPPED",
  };
}

/**
 * Assigns Slack attribution for one request or persists a channel mapping.
 *
 * - ASSIGN_ONCE: one-off attribution, no SlackChannelMapping write.
 * - MAP_CHANNEL: upserts SlackChannelMapping for future requests (except DMs).
 */
export async function createOrUpdateSlackChannelMapping(input: {
  mode: SlackChannelMappingMode;
  organizationId: string;
  slackTeamId: string;
  slackChannelId: string;
  slackChannelName?: string;
  clientId?: string | null;
  projectId?: string | null;
  workflowTypeId?: string | null;
  channelType?: "channel" | "group" | "im" | "mpim" | string;
}): Promise<SlackAttribution> {
  if (input.mode === "ASSIGN_ONCE") {
    await validateAttributionOwnership({
      organizationId: input.organizationId,
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      workflowTypeId: input.workflowTypeId ?? null,
    });

    return buildOneRequestAttribution(input);
  }

  const workspace = await db.slackWorkspace.findUnique({
    where: {
      slackTeamId: input.slackTeamId,
    },
  });

  if (!workspace) {
    return {
      organizationId: null,
      clientId: null,
      projectId: null,
      workflowTypeId: null,
      mappingStatus: "UNKNOWN_WORKSPACE",
    };
  }

  if (workspace.organizationId !== input.organizationId) {
    throw new Error("Slack workspace does not belong to organization");
  }

  // DMs and group DMs are never persisted by default — only attributed for
  // the current request. When channelType is omitted we allow mapping because
  // public/private channels are the common case; explicit "im"/"mpim" opts out.
  if (isDirectOrGroupDm(input.channelType)) {
    await validateAttributionOwnership({
      organizationId: input.organizationId,
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      workflowTypeId: input.workflowTypeId ?? null,
    });

    logger.info(
      {
        organizationId: input.organizationId,
        slackTeamId: input.slackTeamId,
        slackChannelId: input.slackChannelId,
        channelType: input.channelType,
        mode: input.mode,
      },
      "Skipping persistent Slack channel mapping for DM or group DM",
    );

    return buildOneRequestAttribution(input);
  }

  await validateAttributionOwnership({
    organizationId: input.organizationId,
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    workflowTypeId: input.workflowTypeId ?? null,
  });

  const mapping = await db.slackChannelMapping.upsert({
    where: {
      slackWorkspaceId_slackChannelId: {
        slackWorkspaceId: workspace.id,
        slackChannelId: input.slackChannelId,
      },
    },
    create: {
      organizationId: input.organizationId,
      slackWorkspaceId: workspace.id,
      slackChannelId: input.slackChannelId,
      slackChannelName: input.slackChannelName ?? null,
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      defaultWorkflowTypeId: input.workflowTypeId ?? null,
    },
    update: {
      slackChannelName: input.slackChannelName ?? null,
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
      defaultWorkflowTypeId: input.workflowTypeId ?? null,
    },
  });

  const attribution: SlackAttribution = {
    organizationId: workspace.organizationId,
    clientId: mapping.clientId,
    projectId: mapping.projectId,
    workflowTypeId: mapping.defaultWorkflowTypeId,
    mappingStatus: mapping.clientId ? "MAPPED" : "UNMAPPED",
  };

  logger.info(
    {
      organizationId: attribution.organizationId,
      slackTeamId: input.slackTeamId,
      slackChannelId: input.slackChannelId,
      mappingStatus: attribution.mappingStatus,
      mode: input.mode,
    },
    "Slack channel attribution updated",
  );

  return attribution;
}

function buildOneRequestAttribution(input: {
  organizationId: string;
  clientId?: string | null;
  projectId?: string | null;
  workflowTypeId?: string | null;
}): SlackAttribution {
  return {
    organizationId: input.organizationId,
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    workflowTypeId: input.workflowTypeId ?? null,
    mappingStatus: input.clientId ? "MAPPED" : "UNMAPPED",
  };
}

function isDirectOrGroupDm(channelType?: string): boolean {
  return channelType === "im" || channelType === "mpim";
}

async function validateAttributionOwnership(input: {
  organizationId: string;
  clientId: string | null;
  projectId: string | null;
  workflowTypeId: string | null;
}): Promise<void> {
  if (input.clientId) {
    const client = await db.client.findFirst({
      where: {
        id: input.clientId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!client) {
      throw new Error("Client does not belong to organization");
    }
  }

  if (input.projectId) {
    const project = await db.project.findFirst({
      where: {
        id: input.projectId,
        organizationId: input.organizationId,
        ...(input.clientId ? { clientId: input.clientId } : {}),
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      throw new Error("Project does not belong to organization or client");
    }
  }

  if (input.workflowTypeId) {
    const workflowType = await db.workflowType.findFirst({
      where: {
        id: input.workflowTypeId,
        organizationId: input.organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!workflowType) {
      throw new Error("Workflow type does not belong to organization");
    }
  }
}
