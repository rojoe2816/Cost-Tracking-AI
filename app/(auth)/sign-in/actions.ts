"use server";

import { redirect } from "next/navigation";

import {
  authenticateDashboardCredentials,
  authenticateLocalDemoOwner,
  clearDashboardSession,
  createDashboardSession,
} from "@/lib/auth/session";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function signInAction(formData: FormData): Promise<never> {
  const membership = await authenticateDashboardCredentials({
    email: field(formData, "email"),
    password: field(formData, "password"),
    organizationSlug: field(formData, "organizationSlug") || null,
  });

  if (!membership) redirect("/sign-in?error=invalid-credentials");
  await createDashboardSession(membership);
  redirect("/dashboard");
}

export async function signInLocalDemoAction(): Promise<never> {
  const membership = await authenticateLocalDemoOwner();
  if (!membership) redirect("/sign-in?error=local-demo-unavailable");
  await createDashboardSession(membership);
  redirect("/dashboard");
}

export async function signOutAction(): Promise<never> {
  await clearDashboardSession();
  redirect("/sign-in");
}
