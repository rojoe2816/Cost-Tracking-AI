"use server";

import { revalidatePath } from "next/cache";

import { assertAdminSession } from "@/lib/auth/session";
import {
  createSourceAppWithCredential,
  revokeSourceAppCredentialForAdmin,
  rotateSourceAppCredential,
  setSourceAppActive,
} from "@/lib/internal-ai/sourceAppAdmin";
import {
  normalizeSourceAppScopes,
  SOURCE_APP_SCOPES,
  type SourceAppScope,
} from "@/lib/internal-ai/sourceAppScopes";

export type SourceAppActionResult =
  | {
      ok: true;
      rawKey?: string;
      credential?: { keyPrefix: string; keyLast4: string };
    }
  | { ok: false; message: string };

async function organizationId(): Promise<string> {
  return (await assertAdminSession()).organizationId;
}

function required(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  return trimmed;
}

function selectedScopes(values: readonly string[] | undefined): SourceAppScope[] {
  const scopes = normalizeSourceAppScopes(values ?? [...SOURCE_APP_SCOPES]);
  if (scopes.length === 0) throw new Error("Select at least one API scope.");
  return scopes;
}

function safeMessage(error: unknown): string {
  if (error instanceof Error && error.message.includes("Unique constraint")) {
    return "A source application with that name already exists.";
  }
  return error instanceof Error ? error.message : "Source app operation failed.";
}

export async function createSourceAppAction(input: {
  name: string;
  type: string;
  description: string;
  credentialName: string;
  scopes?: string[];
}): Promise<SourceAppActionResult> {
  try {
    const created = await createSourceAppWithCredential({
      organizationId: await organizationId(),
      name: required(input.name, "Application name"),
      type: required(input.type, "Application type"),
      description: input.description,
      credentialName: required(input.credentialName, "Credential name"),
      scopes: selectedScopes(input.scopes),
    });
    revalidatePath("/settings/source-apps");
    return {
      ok: true,
      rawKey: created.rawKey,
      credential: created.credential,
    };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}

export async function rotateCredentialAction(input: {
  sourceAppId: string;
  name: string;
  scopes?: string[];
}): Promise<SourceAppActionResult> {
  try {
    const rotated = await rotateSourceAppCredential({
      organizationId: await organizationId(),
      sourceAppId: required(input.sourceAppId, "Source app"),
      name: required(input.name, "Credential name"),
      scopes: selectedScopes(input.scopes),
    });

    if (!rotated.ok) return { ok: false, message: rotated.error.message };
    revalidatePath("/settings/source-apps");
    return {
      ok: true,
      rawKey: rotated.value.rawKey,
      credential: rotated.value.credential,
    };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}

export async function revokeCredentialAction(
  credentialId: string,
): Promise<SourceAppActionResult> {
  try {
    const revoked = await revokeSourceAppCredentialForAdmin({
      organizationId: await organizationId(),
      credentialId: required(credentialId, "Credential"),
    });
    if (!revoked.ok) return { ok: false, message: revoked.error.message };
    revalidatePath("/settings/source-apps");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}

export async function setSourceAppActiveAction(input: {
  sourceAppId: string;
  isActive: boolean;
}): Promise<SourceAppActionResult> {
  try {
    const updated = await setSourceAppActive({
      organizationId: await organizationId(),
      sourceAppId: required(input.sourceAppId, "Source app"),
      isActive: input.isActive,
    });
    if (!updated) return { ok: false, message: "Source app was not found." };
    revalidatePath("/settings/source-apps");
    return { ok: true };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}
