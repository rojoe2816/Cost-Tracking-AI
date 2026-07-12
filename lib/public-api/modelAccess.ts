import "server-only";

import { env } from "@/lib/env";
import { db } from "@/lib/db";

export type PublicModelOption = {
  id: string;
  label: string;
  provider: string;
};

function parseAllowedModels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
}

export async function getOrganizationModelOptions(
  organizationId: string,
): Promise<PublicModelOption[]> {
  const connections = await db.modelProviderConnection.findMany({
    where: { organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: {
      providerType: true,
      allowedModels: true,
    },
  });

  const seen = new Set<string>();
  const models: PublicModelOption[] = [];

  for (const connection of connections) {
    for (const model of parseAllowedModels(connection.allowedModels)) {
      if (!seen.has(model)) {
        seen.add(model);
        models.push({ id: model, label: model, provider: connection.providerType });
      }
    }
  }

  if (models.length === 0) {
    const fallback = env.LITELLM_DEFAULT_MODEL ?? "gpt-4o-mini";
    return [{ id: fallback, label: fallback, provider: "litellm" }];
  }

  return models;
}

export async function isOrganizationModelAllowed(
  organizationId: string,
  model: string,
): Promise<boolean> {
  const models = await getOrganizationModelOptions(organizationId);
  return models.some((entry) => entry.id === model);
}
