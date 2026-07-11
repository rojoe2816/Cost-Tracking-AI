import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import type { MembershipRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { demoAgency } from "@/lib/demo-agency";
import { env } from "@/lib/env";

import {
  DASHBOARD_SESSION_VERSION,
  isDashboardAdminRole,
  signDashboardSessionToken,
  verifyDashboardSessionToken,
} from "./sessionToken";

export const DASHBOARD_SESSION_COOKIE = "slate_dashboard_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export type DashboardSession = {
  userId: string;
  userEmail: string;
  userName: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: MembershipRole;
  expiresAt: number;
};

export class DashboardAuthorizationError extends Error {
  constructor(message = "Administrator access is required.") {
    super(message);
    this.name = "DashboardAuthorizationError";
  }
}

function getSessionSecret(): string {
  const secret = env.SESSION_SECRET ??
    (env.NODE_ENV !== "production" ? env.ENCRYPTION_KEY : undefined);

  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be configured with at least 32 characters in production.",
    );
  }

  return secret;
}

function secureEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function isLoopbackUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function isLocalDemoSignInAvailable(): boolean {
  return env.NODE_ENV !== "production" && isLoopbackUrl(env.APP_BASE_URL);
}

export function isProductionAdminAuthConfigured(): boolean {
  return Boolean(
    env.SESSION_SECRET &&
      env.SLATE_ADMIN_EMAIL &&
      env.SLATE_ADMIN_PASSWORD,
  );
}

async function findMembership(input: {
  email: string;
  organizationSlug?: string | null;
}) {
  const user = await db.appUser.findUnique({
    where: { email: input.email.trim().toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      memberships: {
        ...(input.organizationSlug
          ? { where: { organization: { slug: input.organizationSlug } } }
          : {}),
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          role: true,
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    },
  });

  const membership = user?.memberships[0];
  if (!user || !membership) return null;

  return {
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    role: membership.role,
  };
}

export async function findMembershipByUserId(input: {
  userId: string;
  organizationSlug?: string | null | undefined;
}): Promise<Omit<DashboardSession, "expiresAt"> | null> {
  const user = await db.appUser.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      name: true,
      memberships: {
        ...(input.organizationSlug
          ? { where: { organization: { slug: input.organizationSlug } } }
          : {}),
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          role: true,
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    },
  });

  const membership = user?.memberships[0];
  if (!user || !membership) return null;

  return {
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    role: membership.role,
  };
}

export async function authenticateDashboardCredentials(input: {
  email: string;
  password: string;
  organizationSlug?: string | null;
}): Promise<Omit<DashboardSession, "expiresAt"> | null> {
  if (!env.SLATE_ADMIN_EMAIL || !env.SLATE_ADMIN_PASSWORD) return null;

  const email = input.email.trim().toLowerCase();
  const configuredEmail = env.SLATE_ADMIN_EMAIL.trim().toLowerCase();
  if (
    !secureEqual(email, configuredEmail) ||
    !secureEqual(input.password, env.SLATE_ADMIN_PASSWORD)
  ) {
    return null;
  }

  return findMembership({
    email,
    organizationSlug:
      input.organizationSlug?.trim() ||
      env.SLATE_ADMIN_ORGANIZATION_SLUG ||
      null,
  });
}

export async function authenticateLocalDemoOwner(): Promise<
  Omit<DashboardSession, "expiresAt"> | null
> {
  if (!isLocalDemoSignInAvailable()) return null;
  return findMembership({
    email: demoAgency.owner.email,
    organizationSlug: demoAgency.slug,
  });
}

export async function createDashboardSession(
  membership: Omit<DashboardSession, "expiresAt">,
): Promise<void> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const token = signDashboardSessionToken(
    {
      version: DASHBOARD_SESSION_VERSION,
      userId: membership.userId,
      organizationId: membership.organizationId,
      role: membership.role,
      expiresAt,
    },
    getSessionSecret(),
  );

  const cookieStore = await cookies();
  cookieStore.set(DASHBOARD_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearDashboardSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(DASHBOARD_SESSION_COOKIE);
}

export async function getDashboardSession(): Promise<DashboardSession | null> {
  let secret: string;
  try {
    secret = getSessionSecret();
  } catch {
    return null;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(DASHBOARD_SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = verifyDashboardSessionToken(token, secret);
  if (!payload) return null;

  const membership = await db.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: payload.organizationId,
        userId: payload.userId,
      },
    },
    select: {
      role: true,
      user: { select: { id: true, email: true, name: true } },
      organization: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!membership) return null;

  return {
    userId: membership.user.id,
    userEmail: membership.user.email,
    userName: membership.user.name,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    organizationSlug: membership.organization.slug,
    role: membership.role,
    expiresAt: payload.expiresAt,
  };
}

export async function requireDashboardSession(): Promise<DashboardSession> {
  const session = await getDashboardSession();
  if (!session) redirect("/login" as import("next").Route);
  return session;
}

export async function requireAdminSession(): Promise<DashboardSession> {
  const session = await requireDashboardSession();
  if (!isDashboardAdminRole(session.role)) {
    redirect("/dashboard");
  }
  return session;
}

export async function assertAdminSession(): Promise<DashboardSession> {
  const session = await getDashboardSession();
  if (!session) throw new DashboardAuthorizationError("Sign in is required.");
  if (!isDashboardAdminRole(session.role)) {
    throw new DashboardAuthorizationError();
  }
  return session;
}
