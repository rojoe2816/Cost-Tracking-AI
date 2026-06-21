import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

import {
  extractKeyLast4,
  extractKeyPrefix,
  generateRawSourceAppApiKey,
  hashSourceAppApiKey,
  isValidRawKeyFormat,
  verifySourceAppApiKey,
} from "./sourceAppApiKey";

export {
  SOURCE_APP_API_KEY_PREFIX,
  hashSourceAppApiKey,
} from "./sourceAppApiKey";

export type SourceAppAuthContext = {
  organizationId: string;
  sourceAppId: string;
  credentialId: string;
  sourceAppName: string;
  sourceAppType: string;
};

export type SourceAppCredentialSafeMetadata = {
  id: string;
  organizationId: string;
  sourceAppId: string;
  sourceAppName: string;
  name: string;
  keyPrefix: string;
  keyLast4: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type SourceAppAuthErrorCode =
  | "SOURCE_APP_NOT_FOUND"
  | "SOURCE_APP_INACTIVE"
  | "MISSING_AUTHORIZATION"
  | "INVALID_AUTHORIZATION_SCHEME"
  | "MISSING_TOKEN"
  | "MALFORMED_API_KEY"
  | "INVALID_API_KEY"
  | "CREDENTIAL_INACTIVE"
  | "CREDENTIAL_REVOKED"
  | "CREDENTIAL_NOT_FOUND";

export type SourceAppAuthResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: SourceAppAuthErrorCode; message: string } };

function reject<T>(
  code: SourceAppAuthErrorCode,
  message: string,
): SourceAppAuthResult<T> {
  return { ok: false, error: { code, message } };
}

function toSafeMetadata(credential: {
  id: string;
  organizationId: string;
  sourceAppId: string;
  name: string;
  keyPrefix: string;
  keyLast4: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  sourceApp: { name: string };
}): SourceAppCredentialSafeMetadata {
  return {
    id: credential.id,
    organizationId: credential.organizationId,
    sourceAppId: credential.sourceAppId,
    sourceAppName: credential.sourceApp.name,
    name: credential.name,
    keyPrefix: credential.keyPrefix,
    keyLast4: credential.keyLast4,
    isActive: credential.isActive,
    lastUsedAt: credential.lastUsedAt,
    revokedAt: credential.revokedAt,
    createdAt: credential.createdAt,
  };
}

export async function createSourceAppCredential(input: {
  organizationId: string;
  sourceAppId: string;
  name: string;
  scopes?: Prisma.InputJsonValue | null;
}): Promise<
  SourceAppAuthResult<{ rawKey: string; credential: SourceAppCredentialSafeMetadata }>
> {
  const sourceApp = await db.aiSourceApp.findFirst({
    where: {
      id: input.sourceAppId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      name: true,
      isActive: true,
    },
  });

  if (!sourceApp) {
    return reject("SOURCE_APP_NOT_FOUND", "Source app not found for this organization.");
  }

  if (!sourceApp.isActive) {
    return reject("SOURCE_APP_INACTIVE", "Source app is inactive.");
  }

  const rawKey = generateRawSourceAppApiKey();
  const credential = await db.aiSourceAppCredential.create({
    data: {
      organizationId: input.organizationId,
      sourceAppId: input.sourceAppId,
      name: input.name.trim(),
      keyPrefix: extractKeyPrefix(rawKey),
      keyHash: hashSourceAppApiKey(rawKey),
      keyLast4: extractKeyLast4(rawKey),
      ...(input.scopes ? { scopes: input.scopes } : {}),
    },
    select: {
      id: true,
      organizationId: true,
      sourceAppId: true,
      name: true,
      keyPrefix: true,
      keyLast4: true,
      isActive: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
      sourceApp: { select: { name: true } },
    },
  });

  return {
    ok: true,
    value: {
      rawKey,
      credential: toSafeMetadata({
        ...credential,
        sourceApp: { name: sourceApp.name },
      }),
    },
  };
}

export function parseBearerToken(
  authorizationHeader: string | null | undefined,
): SourceAppAuthResult<string> {
  if (!authorizationHeader?.trim()) {
    return reject("MISSING_AUTHORIZATION", "Authorization header is required.");
  }

  const [scheme, token, ...rest] = authorizationHeader.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || rest.length > 0) {
    return reject(
      "INVALID_AUTHORIZATION_SCHEME",
      "Authorization header must use Bearer scheme.",
    );
  }

  if (!token?.trim()) {
    return reject("MISSING_TOKEN", "Bearer token is missing.");
  }

  return { ok: true, value: token.trim() };
}

export async function authenticateSourceAppRequest(
  rawKey: string,
): Promise<SourceAppAuthResult<SourceAppAuthContext>> {
  if (!isValidRawKeyFormat(rawKey)) {
    return reject("MALFORMED_API_KEY", "API key format is invalid.");
  }

  const keyPrefix = extractKeyPrefix(rawKey);
  const candidates = await db.aiSourceAppCredential.findMany({
    where: { keyPrefix },
    select: {
      id: true,
      organizationId: true,
      sourceAppId: true,
      keyHash: true,
      isActive: true,
      revokedAt: true,
      sourceApp: {
        select: {
          name: true,
          type: true,
          isActive: true,
        },
      },
    },
  });

  const credential = candidates.find((row) =>
    verifySourceAppApiKey(rawKey, row.keyHash),
  );

  if (!credential) {
    return reject("INVALID_API_KEY", "API key is invalid.");
  }

  if (!credential.isActive) {
    return reject("CREDENTIAL_INACTIVE", "API credential is inactive.");
  }

  if (credential.revokedAt) {
    return reject("CREDENTIAL_REVOKED", "API credential has been revoked.");
  }

  if (!credential.sourceApp.isActive) {
    return reject("SOURCE_APP_INACTIVE", "Source app is inactive.");
  }

  await db.aiSourceAppCredential.update({
    where: { id: credential.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    ok: true,
    value: {
      organizationId: credential.organizationId,
      sourceAppId: credential.sourceAppId,
      credentialId: credential.id,
      sourceAppName: credential.sourceApp.name,
      sourceAppType: credential.sourceApp.type,
    },
  };
}

export async function revokeSourceAppCredential(input: {
  organizationId: string;
  credentialId: string;
}): Promise<SourceAppAuthResult<SourceAppCredentialSafeMetadata>> {
  const existing = await db.aiSourceAppCredential.findFirst({
    where: {
      id: input.credentialId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      organizationId: true,
      sourceAppId: true,
      name: true,
      keyPrefix: true,
      keyLast4: true,
      isActive: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
      sourceApp: { select: { name: true } },
    },
  });

  if (!existing) {
    return reject("CREDENTIAL_NOT_FOUND", "Credential not found for this organization.");
  }

  const credential = await db.aiSourceAppCredential.update({
    where: { id: existing.id },
    data: {
      isActive: false,
      revokedAt: existing.revokedAt ?? new Date(),
    },
    select: {
      id: true,
      organizationId: true,
      sourceAppId: true,
      name: true,
      keyPrefix: true,
      keyLast4: true,
      isActive: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
      sourceApp: { select: { name: true } },
    },
  });

  return { ok: true, value: toSafeMetadata(credential) };
}

export async function listSourceAppCredentials(
  organizationId: string,
  sourceAppId?: string,
): Promise<SourceAppCredentialSafeMetadata[]> {
  const credentials = await db.aiSourceAppCredential.findMany({
    where: {
      organizationId,
      ...(sourceAppId ? { sourceAppId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      organizationId: true,
      sourceAppId: true,
      name: true,
      keyPrefix: true,
      keyLast4: true,
      isActive: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
      sourceApp: { select: { name: true } },
    },
  });

  return credentials.map(toSafeMetadata);
}
