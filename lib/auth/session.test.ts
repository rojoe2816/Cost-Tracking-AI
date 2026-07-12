import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCookiesGet = vi.hoisted(() => vi.fn());
const mockCookiesDelete = vi.hoisted(() => vi.fn());
const mockCookiesSet = vi.hoisted(() => vi.fn());
const mockRedirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);
const mockDb = vi.hoisted(() => ({
  membership: { findUnique: vi.fn() },
  appUser: { findUnique: vi.fn() },
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: mockCookiesGet,
    set: mockCookiesSet,
    delete: mockCookiesDelete,
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/env", () => ({
  env: {
    NODE_ENV: "test",
    SESSION_SECRET: "test-session-secret-that-is-at-least-32-characters",
    ENCRYPTION_KEY: "test-encryption-key-that-is-at-least-32-chars",
    APP_BASE_URL: "http://127.0.0.1:3000",
    SLATE_ADMIN_EMAIL: undefined,
    SLATE_ADMIN_PASSWORD: undefined,
    SLATE_ADMIN_ORGANIZATION_SLUG: undefined,
  },
}));

vi.mock("@/lib/demo-agency", () => ({
  demoAgency: {
    slug: "demo-agency",
    owner: { email: "owner@demo.agency" },
  },
}));

import {
  DASHBOARD_SESSION_VERSION,
  signDashboardSessionToken,
} from "./sessionToken";
import {
  assertAdminSession,
  getDashboardSession,
  requireAdminSession,
} from "./session";

const SECRET = "test-session-secret-that-is-at-least-32-characters";

function signedToken(overrides: {
  userId?: string;
  organizationId?: string;
  role?: "OWNER" | "ADMIN" | "MEMBER";
  expiresAt?: number;
}) {
  return signDashboardSessionToken(
    {
      version: DASHBOARD_SESSION_VERSION,
      userId: overrides.userId ?? "user_a",
      organizationId: overrides.organizationId ?? "org_a",
      role: overrides.role ?? "OWNER",
      expiresAt: overrides.expiresAt ?? Date.now() + 60_000,
    },
    SECRET,
  );
}

describe("dashboard session enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookiesGet.mockReturnValue(undefined);
    mockDb.membership.findUnique.mockResolvedValue(null);
  });

  it("returns null when membership no longer exists", async () => {
    mockCookiesGet.mockReturnValue({ value: signedToken({}) });
    mockDb.membership.findUnique.mockResolvedValue(null);

    await expect(getDashboardSession()).resolves.toBeNull();
  });

  it("rejects MEMBER for admin-only mutations via assertAdminSession", async () => {
    mockCookiesGet.mockReturnValue({
      value: signedToken({ role: "MEMBER" }),
    });
    mockDb.membership.findUnique.mockResolvedValue({
      role: "MEMBER",
      user: { id: "user_a", email: "member@demo.agency", name: "Member" },
      organization: {
        id: "org_a",
        name: "Demo Agency",
        slug: "demo-agency",
      },
    });

    await expect(assertAdminSession()).rejects.toThrow(
      "Administrator access is required.",
    );
  });

  it("redirects MEMBER away from requireAdminSession", async () => {
    mockCookiesGet.mockReturnValue({
      value: signedToken({ role: "MEMBER" }),
    });
    mockDb.membership.findUnique.mockResolvedValue({
      role: "MEMBER",
      user: { id: "user_a", email: "member@demo.agency", name: "Member" },
      organization: {
        id: "org_a",
        name: "Demo Agency",
        slug: "demo-agency",
      },
    });

    await expect(requireAdminSession()).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("allows OWNER through assertAdminSession", async () => {
    mockCookiesGet.mockReturnValue({
      value: signedToken({ role: "OWNER" }),
    });
    mockDb.membership.findUnique.mockResolvedValue({
      role: "OWNER",
      user: { id: "user_a", email: "owner@demo.agency", name: "Owner" },
      organization: {
        id: "org_a",
        name: "Demo Agency",
        slug: "demo-agency",
      },
    });

    await expect(assertAdminSession()).resolves.toMatchObject({
      userId: "user_a",
      organizationId: "org_a",
      role: "OWNER",
    });
  });
});
