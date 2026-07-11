import "server-only";

import { db } from "@/lib/db";

import {
  assertProductionPasswordAllowed,
  hashPassword,
  isWeakPassword,
  verifyPassword,
} from "./password";
import type { DashboardSession } from "./session";
import {
  clearDashboardSession,
  createDashboardSession,
  findMembershipByUserId,
} from "./session";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const GENERIC_FAILURE = "Invalid username or password.";

export type PasswordLoginResult =
  | { ok: true; session: Omit<DashboardSession, "expiresAt">; mustChangePassword: boolean }
  | { ok: false; error: string; locked?: boolean };

export async function authenticateUsernamePassword(input: {
  username: string;
  password: string;
  organizationSlug?: string | null;
}): Promise<PasswordLoginResult> {
  const username = input.username.trim().toLowerCase();
  const credential = await db.passwordCredential.findUnique({
    where: { username },
    select: {
      id: true,
      userId: true,
      passwordHash: true,
      failedAttemptCount: true,
      lockedUntil: true,
      mustChangePassword: true,
    },
  });

  // Constant-ish failure path: do not reveal whether the username exists.
  if (!credential) {
    await hashPassword(input.password);
    return { ok: false, error: GENERIC_FAILURE };
  }

  if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
    return {
      ok: false,
      error: "Too many failed attempts. Try again later.",
      locked: true,
    };
  }

  const valid = await verifyPassword(input.password, credential.passwordHash);
  if (!valid) {
    const failedAttemptCount = credential.failedAttemptCount + 1;
    const lockedUntil =
      failedAttemptCount >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MS)
        : null;

    await db.passwordCredential.update({
      where: { id: credential.id },
      data: {
        failedAttemptCount,
        lockedUntil,
      },
    });

    return {
      ok: false,
      error:
        lockedUntil != null
          ? "Too many failed attempts. Try again later."
          : GENERIC_FAILURE,
      locked: lockedUntil != null,
    };
  }

  const membership = await findMembershipByUserId({
    userId: credential.userId,
    ...(input.organizationSlug != null
      ? { organizationSlug: input.organizationSlug }
      : {}),
  });

  if (!membership) {
    return { ok: false, error: GENERIC_FAILURE };
  }

  await db.passwordCredential.update({
    where: { id: credential.id },
    data: { failedAttemptCount: 0, lockedUntil: null },
  });

  return {
    ok: true,
    session: membership,
    mustChangePassword: credential.mustChangePassword,
  };
}

export async function changePasswordForUser(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const credential = await db.passwordCredential.findUnique({
    where: { userId: input.userId },
  });

  if (!credential) {
    return { ok: false, error: "Password credentials were not found." };
  }

  const valid = await verifyPassword(
    input.currentPassword,
    credential.passwordHash,
  );
  if (!valid) {
    return { ok: false, error: "Current password is incorrect." };
  }

  if (process.env.NODE_ENV === "production" && isWeakPassword(input.newPassword)) {
    return {
      ok: false,
      error: "Choose a stronger password with at least 8 characters.",
    };
  }

  if (input.newPassword.length < 4) {
    return { ok: false, error: "Choose a stronger password." };
  }

  const passwordHash = await hashPassword(input.newPassword);
  await db.passwordCredential.update({
    where: { id: credential.id },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      failedAttemptCount: 0,
      lockedUntil: null,
    },
  });

  await clearDashboardSession();
  return { ok: true };
}

export async function upsertSeedPasswordCredential(input: {
  userId: string;
  username: string;
  password: string;
  mustChangePassword?: boolean;
}): Promise<void> {
  assertProductionPasswordAllowed(input.password);
  const passwordHash = await hashPassword(input.password);
  await db.passwordCredential.upsert({
    where: { userId: input.userId },
    update: {
      username: input.username.trim().toLowerCase(),
      passwordHash,
      mustChangePassword: input.mustChangePassword ?? true,
      failedAttemptCount: 0,
      lockedUntil: null,
      passwordChangedAt: new Date(),
    },
    create: {
      userId: input.userId,
      username: input.username.trim().toLowerCase(),
      passwordHash,
      mustChangePassword: input.mustChangePassword ?? true,
    },
  });
}

export async function completePasswordLogin(
  membership: Omit<DashboardSession, "expiresAt">,
): Promise<void> {
  await createDashboardSession(membership);
}
