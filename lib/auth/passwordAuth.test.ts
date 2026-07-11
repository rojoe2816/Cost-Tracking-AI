import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  passwordCredential: {
    findUnique: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
}));

const mockFindMembershipByUserId = vi.hoisted(() => vi.fn());
const mockCreateDashboardSession = vi.hoisted(() => vi.fn());
const mockClearDashboardSession = vi.hoisted(() => vi.fn());
const mockHashPassword = vi.hoisted(() => vi.fn(async () => "hash"));
const mockVerifyPassword = vi.hoisted(() => vi.fn(async () => false));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("./password", () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
  isWeakPassword: (value: string) => value.length < 8 || value === "2816",
  assertProductionPasswordAllowed: vi.fn(),
}));
vi.mock("./session", () => ({
  findMembershipByUserId: mockFindMembershipByUserId,
  createDashboardSession: mockCreateDashboardSession,
  clearDashboardSession: mockClearDashboardSession,
}));

import {
  authenticateUsernamePassword,
  changePasswordForUser,
} from "./passwordAuth";

describe("password authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyPassword.mockResolvedValue(false);
  });

  it("returns a generic failure for unknown usernames", async () => {
    mockDb.passwordCredential.findUnique.mockResolvedValue(null);

    await expect(
      authenticateUsernamePassword({
        username: "missing",
        password: "whatever",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Invalid username or password.",
    });
    expect(mockHashPassword).toHaveBeenCalled();
  });

  it("locks out after repeated failures", async () => {
    mockDb.passwordCredential.findUnique.mockResolvedValue({
      id: "cred_1",
      userId: "user_1",
      passwordHash: "hash",
      failedAttemptCount: 4,
      lockedUntil: null,
      mustChangePassword: false,
    });
    mockDb.passwordCredential.update.mockResolvedValue({});

    const result = await authenticateUsernamePassword({
      username: "rohan",
      password: "wrong",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.locked).toBe(true);
    }
    expect(mockDb.passwordCredential.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedAttemptCount: 5 }),
      }),
    );
  });

  it("authenticates a valid username and password", async () => {
    mockVerifyPassword.mockResolvedValue(true);
    mockDb.passwordCredential.findUnique.mockResolvedValue({
      id: "cred_1",
      userId: "user_1",
      passwordHash: "hash",
      failedAttemptCount: 1,
      lockedUntil: null,
      mustChangePassword: true,
    });
    mockDb.passwordCredential.update.mockResolvedValue({});
    mockFindMembershipByUserId.mockResolvedValue({
      userId: "user_1",
      userEmail: "owner@example.com",
      userName: "Demo Owner",
      organizationId: "org_a",
      organizationName: "Demo Agency",
      organizationSlug: "demo-agency",
      role: "OWNER",
    });

    await expect(
      authenticateUsernamePassword({
        username: "rohan",
        password: "correct-password",
      }),
    ).resolves.toMatchObject({
      ok: true,
      mustChangePassword: true,
    });
  });

  it("rejects the current password when changing credentials", async () => {
    mockDb.passwordCredential.findUnique.mockResolvedValue({
      id: "cred_1",
      passwordHash: "hash",
    });
    mockVerifyPassword.mockResolvedValue(false);

    await expect(
      changePasswordForUser({
        userId: "user_1",
        currentPassword: "wrong",
        newPassword: "new-secret",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Current password is incorrect.",
    });
  });
});
