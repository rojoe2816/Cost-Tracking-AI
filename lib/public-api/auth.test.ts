import { beforeEach, describe, expect, it, vi } from "vitest";

const mockParseBearerToken = vi.hoisted(() => vi.fn());
const mockAuthenticate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/internal-ai/sourceAppAuth", () => ({
  parseBearerToken: mockParseBearerToken,
  authenticateSourceAppRequest: mockAuthenticate,
}));

import { authenticatePublicApiAuthorizationHeader } from "./auth";

describe("public API credential scopes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParseBearerToken.mockReturnValue({ ok: true, value: "raw-key" });
    mockAuthenticate.mockResolvedValue({
      ok: true,
      value: {
        organizationId: "org_a",
        sourceAppId: "app_a",
        credentialId: "cred_a",
        sourceAppName: "Company AI",
        sourceAppType: "internal_ai",
        scopes: ["context:read"],
      },
    });
  });

  it("allows an operation covered by the credential scope", async () => {
    await expect(
      authenticatePublicApiAuthorizationHeader(
        "Bearer slate_app_sk_test",
        "context:read",
      ),
    ).resolves.toMatchObject({ ok: true });
  });

  it("returns 403 before the operation when scope is missing", async () => {
    await expect(
      authenticatePublicApiAuthorizationHeader(
        "Bearer slate_app_sk_test",
        "context:write",
      ),
    ).resolves.toEqual({
      ok: false,
      status: 403,
      error: {
        code: "INSUFFICIENT_SCOPE",
        message: "API credential requires the context:write scope.",
      },
    });
  });
});
