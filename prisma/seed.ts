import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: "lighthouse-studio" },
    update: {
      name: "Lighthouse Studio",
    },
    create: {
      name: "Lighthouse Studio",
      slug: "lighthouse-studio",
    },
  });

  const ava = await prisma.appUser.upsert({
    where: { email: "ava@lighthouse.studio" },
    update: {
      name: "Ava Patel",
    },
    create: {
      email: "ava@lighthouse.studio",
      name: "Ava Patel",
    },
  });

  const noah = await prisma.appUser.upsert({
    where: { email: "noah@lighthouse.studio" },
    update: {
      name: "Noah Kim",
    },
    create: {
      email: "noah@lighthouse.studio",
      name: "Noah Kim",
    },
  });

  const milo = await prisma.appUser.upsert({
    where: { email: "milo@lighthouse.studio" },
    update: {
      name: "Milo Chen",
    },
    create: {
      email: "milo@lighthouse.studio",
      name: "Milo Chen",
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: ava.id,
      },
    },
    update: {
      role: "OWNER",
    },
    create: {
      organizationId: organization.id,
      userId: ava.id,
      role: "OWNER",
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: noah.id,
      },
    },
    update: {
      role: "ADMIN",
    },
    create: {
      organizationId: organization.id,
      userId: noah.id,
      role: "ADMIN",
    },
  });

  await prisma.membership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: milo.id,
      },
    },
    update: {
      role: "MEMBER",
    },
    create: {
      organizationId: organization.id,
      userId: milo.id,
      role: "MEMBER",
    },
  });

  const northstar = await prisma.client.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: "Northstar Travel",
      },
    },
    update: {
      externalAccountingId: "qb-northstar-001",
      status: "ACTIVE",
    },
    create: {
      organizationId: organization.id,
      name: "Northstar Travel",
      externalAccountingId: "qb-northstar-001",
      status: "ACTIVE",
    },
  });

  const sparrow = await prisma.client.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: "Sparrow Health",
      },
    },
    update: {
      externalAccountingId: "xero-sparrow-009",
      status: "ACTIVE",
    },
    create: {
      organizationId: organization.id,
      name: "Sparrow Health",
      externalAccountingId: "xero-sparrow-009",
      status: "ACTIVE",
    },
  });

  const opsCopilot = await prisma.project.upsert({
    where: {
      organizationId_clientId_name: {
        organizationId: organization.id,
        clientId: northstar.id,
        name: "Ops Copilot",
      },
    },
    update: {
      status: "ACTIVE",
    },
    create: {
      organizationId: organization.id,
      clientId: northstar.id,
      name: "Ops Copilot",
      status: "ACTIVE",
    },
  });

  const contentQa = await prisma.project.upsert({
    where: {
      organizationId_clientId_name: {
        organizationId: organization.id,
        clientId: sparrow.id,
        name: "Content QA",
      },
    },
    update: {
      status: "ACTIVE",
    },
    create: {
      organizationId: organization.id,
      clientId: sparrow.id,
      name: "Content QA",
      status: "ACTIVE",
    },
  });

  const dailyBrief = await prisma.workflowType.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: "daily-brief-generator",
      },
    },
    update: {
      name: "Daily brief generator",
    },
    create: {
      organizationId: organization.id,
      name: "Daily brief generator",
      slug: "daily-brief-generator",
    },
  });

  const complianceRewrite = await prisma.workflowType.upsert({
    where: {
      organizationId_slug: {
        organizationId: organization.id,
        slug: "compliance-rewrite",
      },
    },
    update: {
      name: "Compliance rewrite",
    },
    create: {
      organizationId: organization.id,
      name: "Compliance rewrite",
      slug: "compliance-rewrite",
    },
  });

  const slackWorkspace = await prisma.slackWorkspace.upsert({
    where: {
      slackTeamId: "T_LIGHTHOUSE",
    },
    update: {
      organizationId: organization.id,
      slackTeamName: "Lighthouse Studio",
      botUserId: "B_LIGHTHOUSE",
    },
    create: {
      organizationId: organization.id,
      slackTeamId: "T_LIGHTHOUSE",
      slackTeamName: "Lighthouse Studio",
      botUserId: "B_LIGHTHOUSE",
    },
  });

  await prisma.slackChannelMapping.upsert({
    where: {
      slackWorkspaceId_slackChannelId: {
        slackWorkspaceId: slackWorkspace.id,
        slackChannelId: "C_NORTHSTAR_OPS",
      },
    },
    update: {
      organizationId: organization.id,
      slackChannelName: "#northstar-ops",
      clientId: northstar.id,
      projectId: opsCopilot.id,
      defaultWorkflowTypeId: dailyBrief.id,
    },
    create: {
      organizationId: organization.id,
      slackWorkspaceId: slackWorkspace.id,
      slackChannelId: "C_NORTHSTAR_OPS",
      slackChannelName: "#northstar-ops",
      clientId: northstar.id,
      projectId: opsCopilot.id,
      defaultWorkflowTypeId: dailyBrief.id,
    },
  });

  await prisma.slackChannelMapping.upsert({
    where: {
      slackWorkspaceId_slackChannelId: {
        slackWorkspaceId: slackWorkspace.id,
        slackChannelId: "C_SPARROW_CONTENT",
      },
    },
    update: {
      organizationId: organization.id,
      slackChannelName: "#sparrow-content",
      clientId: sparrow.id,
      projectId: contentQa.id,
      defaultWorkflowTypeId: complianceRewrite.id,
    },
    create: {
      organizationId: organization.id,
      slackWorkspaceId: slackWorkspace.id,
      slackChannelId: "C_SPARROW_CONTENT",
      slackChannelName: "#sparrow-content",
      clientId: sparrow.id,
      projectId: contentQa.id,
      defaultWorkflowTypeId: complianceRewrite.id,
    },
  });

  await prisma.clientRevenue.upsert({
    where: {
      clientId_projectId_month: {
        clientId: northstar.id,
        projectId: opsCopilot.id,
        month: "2026-06",
      },
    },
    update: {
      revenueUsd: new Prisma.Decimal("18500.00"),
      estimatedLaborCostUsd: new Prisma.Decimal("6200.00"),
    },
    create: {
      organizationId: organization.id,
      clientId: northstar.id,
      projectId: opsCopilot.id,
      month: "2026-06",
      revenueUsd: new Prisma.Decimal("18500.00"),
      estimatedLaborCostUsd: new Prisma.Decimal("6200.00"),
    },
  });

  await prisma.clientRevenue.upsert({
    where: {
      clientId_projectId_month: {
        clientId: sparrow.id,
        projectId: contentQa.id,
        month: "2026-06",
      },
    },
    update: {
      revenueUsd: new Prisma.Decimal("12400.00"),
      estimatedLaborCostUsd: new Prisma.Decimal("5100.00"),
    },
    create: {
      organizationId: organization.id,
      clientId: sparrow.id,
      projectId: contentQa.id,
      month: "2026-06",
      revenueUsd: new Prisma.Decimal("12400.00"),
      estimatedLaborCostUsd: new Prisma.Decimal("5100.00"),
    },
  });

  await prisma.organizationPrivacySettings.upsert({
    where: {
      organizationId: organization.id,
    },
    update: {
      promptStorageMode: "METADATA_ONLY",
    },
    create: {
      organizationId: organization.id,
      promptStorageMode: "METADATA_ONLY",
    },
  });

  const auditRecords = [
    {
      organizationId: organization.id,
      userId: ava.id,
      source: "SLACK" as const,
      status: "COMPLETED" as const,
      externalLiteLlmRequestId: "litellm_req_01",
      slackTeamId: "T_LIGHTHOUSE",
      slackChannelId: "C_NORTHSTAR_OPS",
      slackThreadTs: "1717891200.000100",
      slackMessageTs: "1717891200.000200",
      clientId: northstar.id,
      projectId: opsCopilot.id,
      workflowTypeId: dailyBrief.id,
      promptStored: false,
      errorMessage: null,
    },
    {
      organizationId: organization.id,
      userId: noah.id,
      source: "WEB" as const,
      status: "FAILED" as const,
      externalLiteLlmRequestId: "litellm_req_02",
      slackTeamId: null,
      slackChannelId: null,
      slackThreadTs: null,
      slackMessageTs: null,
      clientId: sparrow.id,
      projectId: contentQa.id,
      workflowTypeId: complianceRewrite.id,
      promptStored: false,
      errorMessage: "Anthropic provider timeout during content QA rewrite.",
    },
  ];

  for (const auditRecord of auditRecords) {
    const existingAudit = await prisma.aiRequestAudit.findFirst({
      where: {
        organizationId: auditRecord.organizationId,
        externalLiteLlmRequestId: auditRecord.externalLiteLlmRequestId,
      },
      select: {
        id: true,
      },
    });

    if (existingAudit) {
      await prisma.aiRequestAudit.update({
        where: {
          id: existingAudit.id,
        },
        data: auditRecord,
      });
      continue;
    }

    await prisma.aiRequestAudit.create({
      data: auditRecord,
    });
  }
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
