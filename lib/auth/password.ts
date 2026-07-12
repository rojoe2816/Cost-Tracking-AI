import "server-only";

import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

const WEAK_PASSWORDS = new Set([
  "2816",
  "password",
  "password123",
  "123456",
  "admin",
  "changeme",
  "change-me-before-production",
]);

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

export function isWeakPassword(password: string): boolean {
  const normalized = password.trim().toLowerCase();
  return password.length < 8 || WEAK_PASSWORDS.has(normalized);
}

export function assertProductionPasswordAllowed(
  password: string,
  nodeEnv = process.env.NODE_ENV,
): void {
  if (nodeEnv === "production" && isWeakPassword(password)) {
    throw new Error(
      "Weak seeded passwords are not allowed in production. Set a strong SEED_ADMIN_PASSWORD.",
    );
  }
}
