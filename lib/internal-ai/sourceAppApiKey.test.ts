import { describe, expect, it } from "vitest";

import {
  extractKeyLast4,
  extractKeyPrefix,
  generateRawSourceAppApiKey,
  hashSourceAppApiKey,
  isValidRawKeyFormat,
  SOURCE_APP_API_KEY_PREFIX,
  verifySourceAppApiKey,
} from "./sourceAppApiKey";

describe("sourceAppApiKey", () => {
  it("generates keys with slate prefix", () => {
    const rawKey = generateRawSourceAppApiKey();
    expect(rawKey.startsWith(SOURCE_APP_API_KEY_PREFIX)).toBe(true);
    expect(isValidRawKeyFormat(rawKey)).toBe(true);
  });

  it("hashes and verifies keys deterministically", () => {
    const rawKey = generateRawSourceAppApiKey();
    const hash = hashSourceAppApiKey(rawKey);

    expect(verifySourceAppApiKey(rawKey, hash)).toBe(true);
    expect(verifySourceAppApiKey(`${rawKey}x`, hash)).toBe(false);
  });

  it("extracts prefix and last4 without storing full key", () => {
    const rawKey = generateRawSourceAppApiKey();
    expect(extractKeyPrefix(rawKey)).toHaveLength(20);
    expect(extractKeyLast4(rawKey)).toHaveLength(4);
  });
});
