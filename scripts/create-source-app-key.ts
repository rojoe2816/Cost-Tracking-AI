import "dotenv/config";

import { PrismaClient } from "@prisma/client";

import { demoAgency } from "../lib/demo-agency";
import {
  extractKeyLast4,
  extractKeyPrefix,
  generateRawSourceAppApiKey,
  hashSourceAppApiKey,
} from "../lib/internal-ai/sourceAppApiKey";

const prisma = new PrismaClient();

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const sourceAppName =
    readArg("--source-app-name") ?? "Mock Company AI Portal";
  const credentialName = readArg("--name") ?? "Local development key";

  const organization = await prisma.organization.findUnique({
    where: { slug: demoAgency.slug },
    select: { id: true, name: true },
  });

  if (!organization) {
    throw new Error(
      `Organization "${demoAgency.slug}" not found. Run: npx prisma db seed`,
    );
  }

  const sourceApp = await prisma.aiSourceApp.findUnique({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: sourceAppName,
      },
    },
    select: { id: true, name: true, isActive: true },
  });

  if (!sourceApp) {
    throw new Error(
      `Source app "${sourceAppName}" not found for ${organization.name}.`,
    );
  }

  if (!sourceApp.isActive) {
    throw new Error(`Source app "${sourceAppName}" is inactive.`);
  }

  const rawKey = generateRawSourceAppApiKey();
  const credential = await prisma.aiSourceAppCredential.create({
    data: {
      organizationId: organization.id,
      sourceAppId: sourceApp.id,
      name: credentialName,
      keyPrefix: extractKeyPrefix(rawKey),
      keyHash: hashSourceAppApiKey(rawKey),
      keyLast4: extractKeyLast4(rawKey),
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      keyLast4: true,
      isActive: true,
      createdAt: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        organization: organization.name,
        sourceApp: sourceApp.name,
        credential,
        rawKey,
        warning:
          "Store this raw key in your password manager or local .env now. It will not be shown again.",
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
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
