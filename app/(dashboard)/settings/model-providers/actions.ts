"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";

import { assertAdminSession } from "@/lib/auth/session";
import {
  saveModelConnection,
  setModelConnectionActive,
  validateModelConnection,
} from "@/lib/model-providers/admin";

async function organizationId(): Promise<string> {
  return (await assertAdminSession()).organizationId;
}

function value(formData: FormData, name: string): string {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry.trim() : "";
}

function finish(notice: string): never {
  revalidatePath("/settings/model-providers");
  redirect(
    `/settings/model-providers?notice=${encodeURIComponent(notice)}` as Route,
  );
}

export async function saveModelConnectionAction(formData: FormData) {
  await saveModelConnection({
    organizationId: await organizationId(),
    connectionId: value(formData, "connectionId") || null,
    name: value(formData, "name"),
    providerType: value(formData, "providerType"),
    endpointUrl: value(formData, "endpointUrl") || null,
    credential: value(formData, "credential") || null,
    allowedModels: value(formData, "allowedModels"),
  });
  finish("Model connection saved.");
}

export async function setModelConnectionActiveAction(formData: FormData) {
  await setModelConnectionActive({
    organizationId: await organizationId(),
    connectionId: value(formData, "connectionId"),
    isActive: value(formData, "isActive") === "true",
  });
  finish("Model connection status updated.");
}

export async function validateModelConnectionAction(formData: FormData) {
  const result = await validateModelConnection({
    organizationId: await organizationId(),
    connectionId: value(formData, "connectionId"),
  });
  finish(result.message);
}
