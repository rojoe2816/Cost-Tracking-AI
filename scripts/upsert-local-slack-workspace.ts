import { PrismaClient } from "@prisma/client";

import { demoAgency } from "../lib/demo-agency";

const prisma = new PrismaClient();

const REAL_SLACK_TEAM_ID = "T0B9STHFV9Q";
const REAL_SLACK_TEAM_NAME = "AI_Cost_Project";

async function main() {
  const organization = await prisma.organization.upsert({
    where: {
      slug: demoAgency.slug,
    },
    update: {
      name: demoAgency.name,
    },
    create: {
      name: demoAgency.name,
      slug: demoAgency.slug,
    },
  });

  const workspace = await prisma.slackWorkspace.upsert({
    where: {
      slackTeamId: REAL_SLACK_TEAM_ID,
    },
    update: {
      organizationId: organization.id,
      slackTeamName: REAL_SLACK_TEAM_NAME,
    },
    create: {
      organizationId: organization.id,
      slackTeamId: REAL_SLACK_TEAM_ID,
      slackTeamName: REAL_SLACK_TEAM_NAME,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        organizationId: organization.id,
        organizationSlug: organization.slug,
        slackWorkspaceId: workspace.id,
        slackTeamId: workspace.slackTeamId,
        slackTeamName: workspace.slackTeamName,
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
