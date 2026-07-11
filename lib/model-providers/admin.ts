import "server-only";

import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/security/encryption";

function parseModels(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((model) => model.trim())
        .filter(Boolean),
    ),
  ];
}

export async function listModelConnections(organizationId: string) {
  const connections = await db.modelProviderConnection.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      providerType: true,
      endpointUrl: true,
      allowedModels: true,
      isActive: true,
      lastValidatedAt: true,
      createdAt: true,
      encryptedCredential: true,
    },
  });

  return connections.map(({ encryptedCredential, ...connection }) => ({
    ...connection,
    allowedModels: Array.isArray(connection.allowedModels)
      ? connection.allowedModels.filter(
          (model): model is string => typeof model === "string",
        )
      : [],
    hasCredential: Boolean(encryptedCredential),
  }));
}

export async function saveModelConnection(input: {
  organizationId: string;
  connectionId?: string | null;
  name: string;
  providerType: string;
  endpointUrl?: string | null;
  credential?: string | null;
  allowedModels: string;
}) {
  const models = parseModels(input.allowedModels);
  if (models.length === 0) throw new Error("At least one allowed model is required.");

  const data = {
    name: input.name.trim(),
    providerType: input.providerType.trim().toLowerCase(),
    endpointUrl: input.endpointUrl?.trim() || null,
    allowedModels: models,
    ...(input.credential?.trim()
      ? { encryptedCredential: encryptSecret(input.credential.trim()) }
      : {}),
  };

  if (input.connectionId) {
    const existing = await db.modelProviderConnection.findFirst({
      where: { id: input.connectionId, organizationId: input.organizationId },
      select: { id: true },
    });
    if (!existing) throw new Error("Model connection was not found.");
    return db.modelProviderConnection.update({ where: { id: existing.id }, data });
  }

  return db.modelProviderConnection.create({
    data: { organizationId: input.organizationId, ...data },
  });
}

export async function setModelConnectionActive(input: {
  organizationId: string;
  connectionId: string;
  isActive: boolean;
}): Promise<boolean> {
  const existing = await db.modelProviderConnection.findFirst({
    where: { id: input.connectionId, organizationId: input.organizationId },
    select: { id: true },
  });
  if (!existing) return false;

  await db.modelProviderConnection.update({
    where: { id: existing.id },
    data: { isActive: input.isActive },
  });
  return true;
}

export async function validateModelConnection(input: {
  organizationId: string;
  connectionId: string;
}): Promise<{ ok: boolean; message: string }> {
  const connection = await db.modelProviderConnection.findFirst({
    where: { id: input.connectionId, organizationId: input.organizationId },
    select: { id: true, providerType: true, endpointUrl: true },
  });
  if (!connection) return { ok: false, message: "Model connection was not found." };
  if (!connection.endpointUrl) return { ok: false, message: "No endpoint URL is configured." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const healthPath =
      connection.providerType === "litellm" ? "/health/liveliness" : "";
    const response = await fetch(
      `${connection.endpointUrl.replace(/\/$/, "")}${healthPath}`,
      { method: "GET", signal: controller.signal },
    );
    if (!response.ok) {
      return { ok: false, message: `Endpoint returned HTTP ${response.status}.` };
    }

    await db.modelProviderConnection.update({
      where: { id: connection.id },
      data: { lastValidatedAt: new Date() },
    });
    return { ok: true, message: "Connection is reachable." };
  } catch {
    return { ok: false, message: "Connection could not be reached." };
  } finally {
    clearTimeout(timeout);
  }
}
