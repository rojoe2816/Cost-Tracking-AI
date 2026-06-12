import { PrismaClient } from "@prisma/client";

import { demoAgency, slugify } from "../lib/demo-agency";

const prisma = new PrismaClient();

const REAL_SLACK_TEAM_ID = "T0B9STHFV9Q";
const REAL_SLACK_CHANNEL_ID = "C0B9BDU4ACF";
const REAL_SLACK_CHANNEL_NAME = "new-channel";
const CLIENT_NAME = "Acme Dental";
const PROJECT_NAME = "SEO Retainer";
const WORKFLOW_TYPE_NAME = "Client Update";

async function main() {
  const organization = await prisma.organization.findUnique({
    where: {
      slug: demoAgency.slug,
    },
    select: {
      id: true,
      slug: true,
    },
  });

  if (!organization) {
    throw new Error("Demo Agency organization not found");
  }

  const workspace = await prisma.slackWorkspace.findUnique({
    where: {
      slackTeamId: REAL_SLACK_TEAM_ID,
    },
    select: {
      id: true,
      organizationId: true,
      slackTeamId: true,
      slackTeamName: true,
    },
  });

  if (!workspace) {
    throw new Error(`Slack workspace ${REAL_SLACK_TEAM_ID} not found`);
  }

  if (workspace.organizationId !== organization.id) {
    throw new Error("Real Slack workspace is not linked to Demo Agency");
  }

  const client = await prisma.client.findUnique({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: CLIENT_NAME,
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!client) {
    throw new Error(`Client not found: ${CLIENT_NAME}`);
  }

  const project = await prisma.project.findUnique({
    where: {
      organizationId_clientId_name: {
        organizationId: organization.id,
        clientId: client.id,
        name: PROJECT_NAME,
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!project) {
    throw new Error(`Project not found: ${PROJECT_NAME}`);
  }

  const workflowType = await prisma.workflowType.findUnique({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: slugify(WORKFLOW_TYPE_NAME),
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!workflowType) {
    throw new Error(`Workflow type not found: ${WORKFLOW_TYPE_NAME}`);
  }

  const mapping = await prisma.slackChannelMapping.upsert({
    where: {
      slackWorkspaceId_slackChannelId: {
        slackWorkspaceId: workspace.id,
        slackChannelId: REAL_SLACK_CHANNEL_ID,
      },
    },
    update: {
      organizationId: organization.id,
      slackChannelName: REAL_SLACK_CHANNEL_NAME,
      clientId: client.id,
      projectId: project.id,
      defaultWorkflowTypeId: workflowType.id,
    },
    create: {
      organizationId: organization.id,
      slackWorkspaceId: workspace.id,
      slackChannelId: REAL_SLACK_CHANNEL_ID,
      slackChannelName: REAL_SLACK_CHANNEL_NAME,
      clientId: client.id,
      projectId: project.id,
      defaultWorkflowTypeId: workflowType.id,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        organizationSlug: organization.slug,
        workspace: {
          slackTeamId: workspace.slackTeamId,
          slackTeamName: workspace.slackTeamName,
        },
        channel: {
          slackChannelId: REAL_SLACK_CHANNEL_ID,
          slackChannelName: REAL_SLACK_CHANNEL_NAME,
        },
        mapping: {
          clientId: client.id,
          clientName: client.name,
          projectId: project.id,
          projectName: project.name,
          workflowTypeId: workflowType.id,
          workflowTypeName: workflowType.name,
          mappingId: mapping.id,
          mappingStatus: mapping.clientId ? "MAPPED" : "UNMAPPED",
        },
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
