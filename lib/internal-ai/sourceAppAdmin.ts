import "server-only";

import { db } from "@/lib/db";
import { microsToUsdDecimal } from "@/lib/db/costs";

import {
  createSourceAppCredential,
  revokeSourceAppCredential,
} from "./sourceAppAuth";
import {
  extractKeyLast4,
  extractKeyPrefix,
  generateRawSourceAppApiKey,
  hashSourceAppApiKey,
} from "./sourceAppApiKey";
import {
  normalizeSourceAppScopes,
  SOURCE_APP_SCOPES,
  type SourceAppScope,
} from "./sourceAppScopes";

export type SourceAppAdminRow = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  credentials: Array<{
    id: string;
    name: string;
    keyPrefix: string;
    keyLast4: string;
    isActive: boolean;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
    scopes: SourceAppScope[];
  }>;
  usage: {
    requests: number;
    totalTokens: number;
    spendUsd: number;
    latestUsageAt: Date | null;
  };
};

export async function listSourceAppsForAdmin(
  organizationId: string,
): Promise<SourceAppAdminRow[]> {
  const [apps, usage] = await Promise.all([
    db.aiSourceApp.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        isActive: true,
        createdAt: true,
        credentials: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            keyPrefix: true,
            keyLast4: true,
            isActive: true,
            lastUsedAt: true,
            revokedAt: true,
            createdAt: true,
            scopes: true,
          },
        },
      },
    }),
    db.aiUsageEvent.groupBy({
      by: ["sourceAppId"],
      where: { organizationId, sourceAppId: { not: null } },
      _count: { _all: true },
      _sum: { totalTokens: true, totalCostMicros: true },
      _max: { occurredAt: true },
    }),
  ]);

  const usageByApp = new Map(
    usage.flatMap((row) =>
      row.sourceAppId
        ? [
            [
              row.sourceAppId,
              {
                requests: row._count._all,
                totalTokens: row._sum.totalTokens ?? 0,
                spendUsd: microsToUsdDecimal(
                  row._sum.totalCostMicros ?? 0n,
                ).toNumber(),
                latestUsageAt: row._max.occurredAt,
              },
            ] as const,
          ]
        : [],
    ),
  );

  return apps.map((app) => ({
    ...app,
    credentials: app.credentials.map((credential) => ({
      ...credential,
      scopes: normalizeSourceAppScopes(credential.scopes),
    })),
    usage: usageByApp.get(app.id) ?? {
      requests: 0,
      totalTokens: 0,
      spendUsd: 0,
      latestUsageAt: null,
    },
  }));
}

export async function createSourceAppWithCredential(input: {
  organizationId: string;
  name: string;
  type: string;
  description?: string | null;
  credentialName: string;
  scopes?: SourceAppScope[];
}) {
  const rawKey = generateRawSourceAppApiKey();

  const created = await db.$transaction(async (transaction) => {
    const sourceApp = await transaction.aiSourceApp.create({
      data: {
        organizationId: input.organizationId,
        name: input.name.trim(),
        type: input.type.trim().toLowerCase(),
        description: input.description?.trim() || null,
      },
      select: { id: true, name: true },
    });

    const credential = await transaction.aiSourceAppCredential.create({
      data: {
        organizationId: input.organizationId,
        sourceAppId: sourceApp.id,
        name: input.credentialName.trim(),
        keyPrefix: extractKeyPrefix(rawKey),
        keyHash: hashSourceAppApiKey(rawKey),
        keyLast4: extractKeyLast4(rawKey),
        scopes: input.scopes ?? [...SOURCE_APP_SCOPES],
      },
      select: {
        id: true,
        keyPrefix: true,
        keyLast4: true,
      },
    });

    return { sourceApp, credential };
  });

  return { rawKey, ...created };
}

export async function rotateSourceAppCredential(input: {
  organizationId: string;
  sourceAppId: string;
  name: string;
  scopes?: SourceAppScope[];
}) {
  return createSourceAppCredential(input);
}

export async function revokeSourceAppCredentialForAdmin(input: {
  organizationId: string;
  credentialId: string;
}) {
  return revokeSourceAppCredential(input);
}

export async function setSourceAppActive(input: {
  organizationId: string;
  sourceAppId: string;
  isActive: boolean;
}): Promise<boolean> {
  const existing = await db.aiSourceApp.findFirst({
    where: { id: input.sourceAppId, organizationId: input.organizationId },
    select: { id: true },
  });

  if (!existing) {
    return false;
  }

  await db.aiSourceApp.update({
    where: { id: existing.id },
    data: { isActive: input.isActive },
  });
  return true;
}
