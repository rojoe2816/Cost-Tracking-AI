import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SOURCE_APP_API_KEY_PREFIX = "slate_app_sk_";
export const KEY_PREFIX_LOOKUP_LENGTH = 20;
const KEY_RANDOM_BYTES = 32;

function getHashSecret(): string {
  const key = process.env.ENCRYPTION_KEY?.trim();

  if (!key || key.length < 32) {
    throw new Error("ENCRYPTION_KEY must be configured for API key hashing.");
  }

  return key;
}

/**
 * HMAC-SHA256 over the raw API key using ENCRYPTION_KEY as pepper.
 * Raw keys are never stored; only this hash is persisted for verification.
 */
export function hashSourceAppApiKey(rawKey: string): string {
  return createHmac("sha256", getHashSecret())
    .update(rawKey)
    .digest("hex");
}

export function verifySourceAppApiKey(rawKey: string, keyHash: string): boolean {
  const computed = hashSourceAppApiKey(rawKey);
  const left = Buffer.from(computed, "utf8");
  const right = Buffer.from(keyHash, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function generateRawSourceAppApiKey(): string {
  const randomPart = randomBytes(KEY_RANDOM_BYTES).toString("base64url");
  return `${SOURCE_APP_API_KEY_PREFIX}${randomPart}`;
}

export function extractKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, KEY_PREFIX_LOOKUP_LENGTH);
}

export function extractKeyLast4(rawKey: string): string {
  return rawKey.slice(-4);
}

export function isValidRawKeyFormat(rawKey: string): boolean {
  return (
    rawKey.startsWith(SOURCE_APP_API_KEY_PREFIX) &&
    rawKey.length > SOURCE_APP_API_KEY_PREFIX.length + 8
  );
}
