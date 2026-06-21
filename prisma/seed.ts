import { PrismaClient } from "@prisma/client";

import { demoAgency, slugify } from "../lib/demo-agency";

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: demoAgency.slug },
    update: {
      name: demoAgency.name,
    },
    create: {
      name: demoAgency.name,
      slug: demoAgency.slug,
    },
  });

  const owner = await prisma.appUser.upsert({
    where: { email: demoAgency.owner.email },
    update: {
      name: demoAgency.owner.name,
    },
    create: {
      email: demoAgency.owner.email,
      name: demoAgency.owner.name,
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: owner.id,
      },
    },
    update: {
      role: demoAgency.owner.role,
    },
    create: {
      organizationId: organization.id,
      userId: owner.id,
      role: demoAgency.owner.role,
    },
  });

  for (const client of demoAgency.clients) {
    const persistedClient = await prisma.client.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: client.name,
        },
      },
      update: {
        externalAccountingId: client.externalAccountingId,
        status: client.status,
      },
      create: {
        organizationId: organization.id,
        name: client.name,
        externalAccountingId: client.externalAccountingId,
        status: client.status,
      },
    });

    for (const project of client.projects) {
      await prisma.project.upsert({
        where: {
          organizationId_clientId_name: {
            organizationId: organization.id,
            clientId: persistedClient.id,
            name: project.name,
          },
        },
        update: {
          status: project.status,
        },
        create: {
          organizationId: organization.id,
          clientId: persistedClient.id,
          name: project.name,
          status: project.status,
        },
      });
    }
  }

  await Promise.all(
    demoAgency.workflowTypes.map((name) =>
      prisma.workflowType.upsert({
        where: {
          organizationId_slug: {
            organizationId: organization.id,
            slug: slugify(name),
          },
        },
        update: {
          name,
        },
        create: {
          organizationId: organization.id,
          name,
          slug: slugify(name),
        },
      }),
    ),
  );

  await Promise.all(
    demoAgency.employees.map((employee) =>
      prisma.employee.upsert({
        where: {
          organizationId_name: {
            organizationId: organization.id,
            name: employee.name,
          },
        },
        update: {
          email: employee.email,
          department: employee.department,
          role: employee.role,
          externalId: employee.externalId,
          isActive: true,
        },
        create: {
          organizationId: organization.id,
          name: employee.name,
          email: employee.email,
          department: employee.department,
          role: employee.role,
          externalId: employee.externalId,
          isActive: true,
        },
      }),
    ),
  );

  await Promise.all(
    demoAgency.sourceApps.map((sourceApp) =>
      prisma.aiSourceApp.upsert({
        where: {
          organizationId_name: {
            organizationId: organization.id,
            name: sourceApp.name,
          },
        },
        update: {
          type: sourceApp.type,
          description: sourceApp.description,
          isActive: true,
        },
        create: {
          organizationId: organization.id,
          name: sourceApp.name,
          type: sourceApp.type,
          description: sourceApp.description,
          isActive: true,
        },
      }),
    ),
  );

  await prisma.organizationPrivacySettings.upsert({
    where: {
      organizationId: organization.id,
    },
    update: {
      promptStorageMode: demoAgency.privacy.promptStorageMode,
    },
    create: {
      organizationId: organization.id,
      promptStorageMode: demoAgency.privacy.promptStorageMode,
    },
  });

  // Local development seed data for Slack simulation (no real Slack OAuth).
  // T_DEMO + C_ACME resolves to a mapped client/project/workflow for pipeline tests.
  // C_UNMAPPED is intentionally not seeded so UNMAPPED assignment flow can be exercised.
  const DEMO_SLACK_TEAM_ID = "T_DEMO";
  const DEMO_SLACK_TEAM_NAME = "Demo Slack Workspace";
  const DEMO_MAPPED_CHANNEL_ID = "C_ACME";
  const DEMO_MAPPED_CHANNEL_NAME = "client-acme-seo";
  const DEMO_CLIENT_NAME = "Acme Dental";
  const DEMO_PROJECT_NAME = "SEO Retainer";
  const DEMO_WORKFLOW_TYPE_NAME = "Client Update";

  const acmeClient = await prisma.client.findUnique({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: DEMO_CLIENT_NAME,
      },
    },
  });

  if (!acmeClient) {
    throw new Error(`Seed prerequisite missing: client "${DEMO_CLIENT_NAME}"`);
  }

  const seoProject = await prisma.project.findUnique({
    where: {
      organizationId_clientId_name: {
        organizationId: organization.id,
        clientId: acmeClient.id,
        name: DEMO_PROJECT_NAME,
      },
    },
  });

  if (!seoProject) {
    throw new Error(`Seed prerequisite missing: project "${DEMO_PROJECT_NAME}"`);
  }

  const clientUpdateWorkflow = await prisma.workflowType.findUnique({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: slugify(DEMO_WORKFLOW_TYPE_NAME),
      },
    },
  });

  if (!clientUpdateWorkflow) {
    throw new Error(
      `Seed prerequisite missing: workflow type "${DEMO_WORKFLOW_TYPE_NAME}"`,
    );
  }

  const slackWorkspace = await prisma.slackWorkspace.upsert({
    where: { slackTeamId: DEMO_SLACK_TEAM_ID },
    update: {
      organizationId: organization.id,
      slackTeamName: DEMO_SLACK_TEAM_NAME,
    },
    create: {
      organizationId: organization.id,
      slackTeamId: DEMO_SLACK_TEAM_ID,
      slackTeamName: DEMO_SLACK_TEAM_NAME,
    },
  });

  await prisma.slackChannelMapping.upsert({
    where: {
      slackWorkspaceId_slackChannelId: {
        slackWorkspaceId: slackWorkspace.id,
        slackChannelId: DEMO_MAPPED_CHANNEL_ID,
      },
    },
    update: {
      organizationId: organization.id,
      slackChannelName: DEMO_MAPPED_CHANNEL_NAME,
      clientId: acmeClient.id,
      projectId: seoProject.id,
      defaultWorkflowTypeId: clientUpdateWorkflow.id,
    },
    create: {
      organizationId: organization.id,
      slackWorkspaceId: slackWorkspace.id,
      slackChannelId: DEMO_MAPPED_CHANNEL_ID,
      slackChannelName: DEMO_MAPPED_CHANNEL_NAME,
      clientId: acmeClient.id,
      projectId: seoProject.id,
      defaultWorkflowTypeId: clientUpdateWorkflow.id,
    },
  });
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
