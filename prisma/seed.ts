import { Prisma, PrismaClient } from "@prisma/client";
import { subDays, subHours } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  const agency = await prisma.agency.upsert({
    where: { slug: "lighthouse-studio" },
    update: {
      name: "Lighthouse Studio",
      plan: "GROWTH",
    },
    create: {
      name: "Lighthouse Studio",
      slug: "lighthouse-studio",
      plan: "GROWTH",
    },
  });

  const ava = await prisma.user.upsert({
    where: { email: "ava@lighthouse.studio" },
    update: {
      name: "Ava Patel",
    },
    create: {
      email: "ava@lighthouse.studio",
      name: "Ava Patel",
      timezone: "America/Los_Angeles",
    },
  });

  const noah = await prisma.user.upsert({
    where: { email: "noah@lighthouse.studio" },
    update: {
      name: "Noah Kim",
    },
    create: {
      email: "noah@lighthouse.studio",
      name: "Noah Kim",
      timezone: "America/New_York",
    },
  });

  const milo = await prisma.user.upsert({
    where: { email: "milo@lighthouse.studio" },
    update: {
      name: "Milo Chen",
    },
    create: {
      email: "milo@lighthouse.studio",
      name: "Milo Chen",
      timezone: "America/Chicago",
    },
  });

  await prisma.agencyMembership.upsert({
    where: {
      agencyId_userId: {
        agencyId: agency.id,
        userId: ava.id,
      },
    },
    update: {
      role: "OWNER",
    },
    create: {
      agencyId: agency.id,
      userId: ava.id,
      role: "OWNER",
    },
  });

  await prisma.agencyMembership.upsert({
    where: {
      agencyId_userId: {
        agencyId: agency.id,
        userId: noah.id,
      },
    },
    update: {
      role: "ADMIN",
    },
    create: {
      agencyId: agency.id,
      userId: noah.id,
      role: "ADMIN",
    },
  });

  await prisma.agencyMembership.upsert({
    where: {
      agencyId_userId: {
        agencyId: agency.id,
        userId: milo.id,
      },
    },
    update: {
      role: "MEMBER",
    },
    create: {
      agencyId: agency.id,
      userId: milo.id,
      role: "MEMBER",
    },
  });

  const northstar = await prisma.client.upsert({
    where: {
      agencyId_slug: {
        agencyId: agency.id,
        slug: "northstar-travel",
      },
    },
    update: {
      name: "Northstar Travel",
      status: "ACTIVE",
    },
    create: {
      agencyId: agency.id,
      name: "Northstar Travel",
      slug: "northstar-travel",
      status: "ACTIVE",
    },
  });

  const sparrow = await prisma.client.upsert({
    where: {
      agencyId_slug: {
        agencyId: agency.id,
        slug: "sparrow-health",
      },
    },
    update: {
      name: "Sparrow Health",
      status: "ACTIVE",
    },
    create: {
      agencyId: agency.id,
      name: "Sparrow Health",
      slug: "sparrow-health",
      status: "ACTIVE",
    },
  });

  const opsCopilot = await prisma.project.upsert({
    where: {
      agencyId_slug: {
        agencyId: agency.id,
        slug: "ops-copilot",
      },
    },
    update: {
      name: "Ops Copilot",
      clientId: northstar.id,
      isActive: true,
    },
    create: {
      agencyId: agency.id,
      clientId: northstar.id,
      name: "Ops Copilot",
      slug: "ops-copilot",
      description: "Slack-embedded internal ops assistant.",
      isActive: true,
    },
  });

  const contentQa = await prisma.project.upsert({
    where: {
      agencyId_slug: {
        agencyId: agency.id,
        slug: "content-qa",
      },
    },
    update: {
      name: "Content QA",
      clientId: sparrow.id,
      isActive: true,
    },
    create: {
      agencyId: agency.id,
      clientId: sparrow.id,
      name: "Content QA",
      slug: "content-qa",
      description: "Editorial compliance assistant.",
      isActive: true,
    },
  });

  const dailyBrief = await prisma.workflow.upsert({
    where: {
      agencyId_slug: {
        agencyId: agency.id,
        slug: "daily-brief-generator",
      },
    },
    update: {
      projectId: opsCopilot.id,
      provider: "OpenAI",
      model: "gpt-4.1-mini",
      status: "LIVE",
    },
    create: {
      agencyId: agency.id,
      projectId: opsCopilot.id,
      name: "Daily brief generator",
      slug: "daily-brief-generator",
      provider: "OpenAI",
      model: "gpt-4.1-mini",
      status: "LIVE",
    },
  });

  const complianceRewrite = await prisma.workflow.upsert({
    where: {
      agencyId_slug: {
        agencyId: agency.id,
        slug: "compliance-rewrite",
      },
    },
    update: {
      projectId: contentQa.id,
      provider: "Anthropic",
      model: "claude-sonnet-4-0",
      status: "LIVE",
    },
    create: {
      agencyId: agency.id,
      projectId: contentQa.id,
      name: "Compliance rewrite",
      slug: "compliance-rewrite",
      provider: "Anthropic",
      model: "claude-sonnet-4-0",
      status: "LIVE",
    },
  });

  const workspace = await prisma.slackWorkspace.upsert({
    where: {
      teamId: "T_LIGHTHOUSE",
    },
    update: {
      agencyId: agency.id,
      name: "Lighthouse Studio",
    },
    create: {
      agencyId: agency.id,
      teamId: "T_LIGHTHOUSE",
      name: "Lighthouse Studio",
      domain: "lighthouse-studio",
      installedAt: subDays(new Date(), 7),
    },
  });

  const northstarOpsChannel = await prisma.slackChannel.upsert({
    where: {
      workspaceId_slackChannelId: {
        workspaceId: workspace.id,
        slackChannelId: "C_NORTHSTAR_OPS",
      },
    },
    update: {
      agencyId: agency.id,
      projectId: opsCopilot.id,
      workflowId: dailyBrief.id,
      name: "#northstar-ops",
    },
    create: {
      agencyId: agency.id,
      workspaceId: workspace.id,
      projectId: opsCopilot.id,
      workflowId: dailyBrief.id,
      slackChannelId: "C_NORTHSTAR_OPS",
      name: "#northstar-ops",
    },
  });

  await prisma.usageEvent.upsert({
    where: {
      requestId: "seed_usage_01",
    },
    update: {
      agencyId: agency.id,
      clientId: northstar.id,
      projectId: opsCopilot.id,
      workflowId: dailyBrief.id,
      userId: ava.id,
      slackChannelId: northstarOpsChannel.id,
      source: "SLACK",
      provider: "OpenAI",
      model: "gpt-4.1-mini",
      promptTokens: 18420,
      completionTokens: 3340,
      totalTokens: 21760,
      inputCost: new Prisma.Decimal("2.742100"),
      outputCost: new Prisma.Decimal("1.440000"),
      totalCost: new Prisma.Decimal("4.182100"),
      occurredAt: subHours(new Date(), 2),
    },
    create: {
      requestId: "seed_usage_01",
      agencyId: agency.id,
      clientId: northstar.id,
      projectId: opsCopilot.id,
      workflowId: dailyBrief.id,
      userId: ava.id,
      slackChannelId: northstarOpsChannel.id,
      source: "SLACK",
      provider: "OpenAI",
      model: "gpt-4.1-mini",
      promptTokens: 18420,
      completionTokens: 3340,
      totalTokens: 21760,
      inputCost: new Prisma.Decimal("2.742100"),
      outputCost: new Prisma.Decimal("1.440000"),
      totalCost: new Prisma.Decimal("4.182100"),
      occurredAt: subHours(new Date(), 2),
    },
  });

  await prisma.usageEvent.upsert({
    where: {
      requestId: "seed_usage_02",
    },
    update: {
      agencyId: agency.id,
      clientId: sparrow.id,
      projectId: contentQa.id,
      workflowId: complianceRewrite.id,
      userId: noah.id,
      source: "WORKFLOW",
      provider: "Anthropic",
      model: "claude-sonnet-4-0",
      promptTokens: 12780,
      completionTokens: 2950,
      totalTokens: 15730,
      inputCost: new Prisma.Decimal("2.014800"),
      outputCost: new Prisma.Decimal("1.600000"),
      totalCost: new Prisma.Decimal("3.614800"),
      occurredAt: subHours(new Date(), 5),
    },
    create: {
      requestId: "seed_usage_02",
      agencyId: agency.id,
      clientId: sparrow.id,
      projectId: contentQa.id,
      workflowId: complianceRewrite.id,
      userId: noah.id,
      source: "WORKFLOW",
      provider: "Anthropic",
      model: "claude-sonnet-4-0",
      promptTokens: 12780,
      completionTokens: 2950,
      totalTokens: 15730,
      inputCost: new Prisma.Decimal("2.014800"),
      outputCost: new Prisma.Decimal("1.600000"),
      totalCost: new Prisma.Decimal("3.614800"),
      occurredAt: subHours(new Date(), 5),
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
