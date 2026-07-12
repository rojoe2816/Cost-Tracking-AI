import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockHash = vi.hoisted(() => vi.fn(async () => "argon2-hash"));
const mockVerify = vi.hoisted(() => vi.fn(async () => true));

vi.mock("@node-rs/argon2", () => ({
  hash: mockHash,
  verify: mockVerify,
}));

import {
  assertProductionPasswordAllowed,
  hashPassword,
  isWeakPassword,
  verifyPassword,
} from "./password";

describe("password hashing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerify.mockResolvedValue(true);
  });

  it("hashes passwords with Argon2id options", async () => {
    await hashPassword("local-demo-secret");
    expect(mockHash).toHaveBeenCalledWith(
      "local-demo-secret",
      expect.objectContaining({ memoryCost: 19456, timeCost: 2 }),
    );
  });

  it("verifies passwords against stored hashes", async () => {
    await expect(verifyPassword("secret", "stored-hash")).resolves.toBe(true);
    expect(mockVerify).toHaveBeenCalledWith(
      "stored-hash",
      "secret",
      expect.any(Object),
    );
  });

  it("treats short and known weak passwords as weak", () => {
    expect(isWeakPassword("2816")).toBe(true);
    expect(isWeakPassword("password")).toBe(true);
    expect(isWeakPassword("strong-enough-pass")).toBe(false);
  });

  it("rejects weak passwords in production", () => {
    expect(() => assertProductionPasswordAllowed("2816", "production")).toThrow(
      /not allowed in production/,
    );
    expect(() =>
      assertProductionPasswordAllowed("strong-enough-pass", "production"),
    ).not.toThrow();
  });
});
