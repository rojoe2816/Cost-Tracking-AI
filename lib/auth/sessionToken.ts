import { createHmac, timingSafeEqual } from "node:crypto";

export const DASHBOARD_SESSION_VERSION = 1 as const;

export type DashboardSessionRole = "OWNER" | "ADMIN" | "MEMBER";

export type DashboardSessionTokenPayload = {
  version: typeof DASHBOARD_SESSION_VERSION;
  userId: string;
  organizationId: string;
  role: DashboardSessionRole;
  expiresAt: number;
};

export function isDashboardAdminRole(role: DashboardSessionRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

const SESSION_ROLES = new Set<DashboardSessionRole>([
  "OWNER",
  "ADMIN",
  "MEMBER",
]);

function signature(value: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(value).digest();
}

function isPayload(value: unknown): value is DashboardSessionTokenPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;

  return (
    payload.version === DASHBOARD_SESSION_VERSION &&
    typeof payload.userId === "string" &&
    payload.userId.length > 0 &&
    typeof payload.organizationId === "string" &&
    payload.organizationId.length > 0 &&
    typeof payload.role === "string" &&
    SESSION_ROLES.has(payload.role as DashboardSessionRole) &&
    typeof payload.expiresAt === "number" &&
    Number.isSafeInteger(payload.expiresAt)
  );
}

export function signDashboardSessionToken(
  payload: DashboardSessionTokenPayload,
  secret: string,
): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const encodedSignature = signature(encodedPayload, secret).toString("base64url");
  return `${encodedPayload}.${encodedSignature}`;
}

export function verifyDashboardSessionToken(
  token: string,
  secret: string,
  nowMs = Date.now(),
): DashboardSessionTokenPayload | null {
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return null;

  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(encodedSignature, "base64url");
  } catch {
    return null;
  }

  const expectedSignature = signature(encodedPayload, secret);
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as unknown;

    if (!isPayload(payload) || payload.expiresAt <= nowMs) return null;
    return payload;
  } catch {
    return null;
  }
}
