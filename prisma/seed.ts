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
