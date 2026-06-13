import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "@/lib/security/encryption";

describe("encryption helpers", () => {
  it("encrypts and decrypts secrets without storing plaintext", () => {
    const plaintext = "xoxb-test-token-value";

    const encrypted = encryptSecret(plaintext);

    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });
});
