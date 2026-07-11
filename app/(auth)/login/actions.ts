"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";

import {
  authenticateUsernamePassword,
  changePasswordForUser,
  completePasswordLogin,
} from "@/lib/auth/passwordAuth";
import {
  clearDashboardSession,
  getDashboardSession,
  requireDashboardSession,
} from "@/lib/auth/session";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function safeNextPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

function redirectTo(path: string): never {
  redirect(path as Route);
}

export async function loginAction(formData: FormData): Promise<never> {
  const next = safeNextPath(field(formData, "next") || "/dashboard");
  const result = await authenticateUsernamePassword({
    username: field(formData, "username"),
    password: field(formData, "password"),
    organizationSlug: field(formData, "organizationSlug") || null,
  });

  if (!result.ok) {
    redirectTo(
      `/login?error=${result.locked ? "locked" : "invalid-credentials"}&next=${encodeURIComponent(next)}`,
    );
  }

  await completePasswordLogin(result.session);

  if (result.mustChangePassword) {
    redirectTo(`/change-password?next=${encodeURIComponent(next)}`);
  }

  redirectTo(next);
}

export async function logoutAction(): Promise<never> {
  await clearDashboardSession();
  redirectTo("/login");
}

export async function changePasswordAction(formData: FormData): Promise<never> {
  const session = await requireDashboardSession();
  const next = safeNextPath(field(formData, "next") || "/dashboard");
  const result = await changePasswordForUser({
    userId: session.userId,
    currentPassword: field(formData, "currentPassword"),
    newPassword: field(formData, "newPassword"),
    confirmPassword: field(formData, "confirmPassword"),
  });

  if (!result.ok) {
    redirectTo(
      `/change-password?error=${encodeURIComponent(result.error)}&next=${encodeURIComponent(next)}`,
    );
  }

  const reauth = await authenticateUsernamePassword({
    username: field(formData, "username"),
    password: field(formData, "newPassword"),
    organizationSlug: session.organizationSlug,
  });

  if (reauth.ok) {
    await completePasswordLogin(reauth.session);
  }

  redirectTo(next);
}

export async function requireAnonymousOrRedirect(): Promise<void> {
  if (await getDashboardSession()) redirectTo("/dashboard");
}
