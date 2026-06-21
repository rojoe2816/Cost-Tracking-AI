import { beforeEach, describe, expect, it, vi } from "vitest";

import { hashSourceAppApiKey, SOURCE_APP_API_KEY_PREFIX } from "./sourceAppApiKey";

const mockDb = vi.hoisted(() => ({
  aiSourceApp: {
    findFirst: vi.fn(),
  },
  aiSourceAppCredential: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

import {
  authenticateSourceAppRequest,
  createSourceAppCredential,
  listSourceAppCredentials,
  parseBearerToken,
  revokeSourceAppCredential,
} from "./sourceAppAuth";

const ORG_ID = "org_demo";
const SOURCE_APP_ID = "app_portal";
const CREDENTIAL_ID = "cred_1";
const RAW_KEY = `${SOURCE_APP_API_KEY_PREFIX}test-secret-key-value-abc123xyz`;
const KEY_HASH = hashSourceAppApiKey(RAW_KEY);
const KEY_PREFIX = RAW_KEY.slice(0, 20);
const KEY_LAST4 = RAW_KEY.slice(-4);

const SOURCE_APP_ROW = {
  id: SOURCE_APP_ID,
  name: "Mock Company AI Portal",
  isActive: true,
};

const CREDENTIAL_ROW = {
  id: CREDENTIAL_ID,
  organizationId: ORG_ID,
  sourceAppId: SOURCE_APP_ID,
  name: "Local dev key",
  keyPrefix: KEY_PREFIX,
  keyHash: KEY_HASH,
  keyLast4: KEY_LAST4,
  isActive: true,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date("2026-06-21T12:00:00.000Z"),
  sourceApp: { name: "Mock Company AI Portal", type: "mock_company_portal", isActive: true },
};

describe("sourceAppAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.aiSourceApp.findFirst.mockResolvedValue(SOURCE_APP_ROW);
    mockDb.aiSourceAppCredential.create.mockImplementation(async ({ data }) => ({
      id: CREDENTIAL_ID,
      organizationId: data.organizationId,
      sourceAppId: data.sourceAppId,
      name: data.name,
      keyPrefix: data.keyPrefix,
      keyLast4: data.keyLast4,
      isActive: true,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date("2026-06-21T12:00:00.000Z"),
      sourceApp: { name: "Mock Company AI Portal" },
    }));
  });

  it("creates credential and returns raw key once", async () => {
    const result = await createSourceAppCredential({
      organizationId: ORG_ID,
      sourceAppId: SOURCE_APP_ID,
      name: "Local dev key",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.rawKey.startsWith(SOURCE_APP_API_KEY_PREFIX)).toBe(true);
      expect(result.value.credential.keyLast4).toBe(result.value.rawKey.slice(-4));
    }
  });

  it("stores hash but not raw key", async () => {
    const result = await createSourceAppCredential({
      organizationId: ORG_ID,
      sourceAppId: SOURCE_APP_ID,
      name: "Local dev key",
    });

    expect(result.ok).toBe(true);
    const createArgs = mockDb.aiSourceAppCredential.create.mock.calls[0]?.[0];
    expect(createArgs?.data.keyHash).toBeTruthy();
    expect(createArgs?.data).not.toHaveProperty("rawKey");
    if (result.ok) {
      expect(JSON.stringify(createArgs)).not.toContain(result.value.rawKey);
    }
  });

  it("authenticates a correct raw key", async () => {
    mockDb.aiSourceAppCredential.findMany.mockResolvedValue([CREDENTIAL_ROW]);
    mockDb.aiSourceAppCredential.update.mockResolvedValue({});

    const result = await authenticateSourceAppRequest(RAW_KEY);

    expect(result).toEqual({
      ok: true,
      value: {
        organizationId: ORG_ID,
        sourceAppId: SOURCE_APP_ID,
        credentialId: CREDENTIAL_ID,
        sourceAppName: "Mock Company AI Portal",
        sourceAppType: "mock_company_portal",
      },
    });
  });

  it("rejects wrong raw key", async () => {
    mockDb.aiSourceAppCredential.findMany.mockResolvedValue([CREDENTIAL_ROW]);

    const result = await authenticateSourceAppRequest(
      `${SOURCE_APP_API_KEY_PREFIX}wrong-key-value`,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_API_KEY");
    }
  });

  it("rejects missing authorization header", () => {
    const result = parseBearerToken(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MISSING_AUTHORIZATION");
    }
  });

  it("rejects non-Bearer authorization scheme", () => {
    const result = parseBearerToken("Basic abc123");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_AUTHORIZATION_SCHEME");
    }
  });

  it("rejects malformed api key format", async () => {
    const result = await authenticateSourceAppRequest("not-a-valid-key");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MALFORMED_API_KEY");
    }
  });

  it("rejects inactive credential", async () => {
    mockDb.aiSourceAppCredential.findMany.mockResolvedValue([
      { ...CREDENTIAL_ROW, isActive: false },
    ]);

    const result = await authenticateSourceAppRequest(RAW_KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CREDENTIAL_INACTIVE");
    }
  });

  it("rejects revoked credential", async () => {
    mockDb.aiSourceAppCredential.findMany.mockResolvedValue([
      {
        ...CREDENTIAL_ROW,
        revokedAt: new Date("2026-06-21T13:00:00.000Z"),
      },
    ]);

    const result = await authenticateSourceAppRequest(RAW_KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CREDENTIAL_REVOKED");
    }
  });

  it("rejects inactive source app", async () => {
    mockDb.aiSourceAppCredential.findMany.mockResolvedValue([
      {
        ...CREDENTIAL_ROW,
        sourceApp: {
          ...CREDENTIAL_ROW.sourceApp,
          isActive: false,
        },
      },
    ]);

    const result = await authenticateSourceAppRequest(RAW_KEY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SOURCE_APP_INACTIVE");
    }
  });

  it("updates lastUsedAt on successful authentication", async () => {
    mockDb.aiSourceAppCredential.findMany.mockResolvedValue([CREDENTIAL_ROW]);
    mockDb.aiSourceAppCredential.update.mockResolvedValue({});

    await authenticateSourceAppRequest(RAW_KEY);

    expect(mockDb.aiSourceAppCredential.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CREDENTIAL_ID },
        data: { lastUsedAt: expect.any(Date) },
      }),
    );
  });

  it("revokes credential without deleting source app", async () => {
    mockDb.aiSourceAppCredential.findFirst.mockResolvedValue({
      ...CREDENTIAL_ROW,
      sourceApp: { name: "Mock Company AI Portal" },
    });
    mockDb.aiSourceAppCredential.update.mockResolvedValue({
      ...CREDENTIAL_ROW,
      isActive: false,
      revokedAt: new Date("2026-06-21T14:00:00.000Z"),
      sourceApp: { name: "Mock Company AI Portal" },
    });

    const result = await revokeSourceAppCredential({
      organizationId: ORG_ID,
      credentialId: CREDENTIAL_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isActive).toBe(false);
      expect(result.value.revokedAt).toBeTruthy();
    }
  });

  it("lists safe metadata without keyHash or raw key", async () => {
    mockDb.aiSourceAppCredential.findMany.mockResolvedValue([
      {
        ...CREDENTIAL_ROW,
        sourceApp: { name: "Mock Company AI Portal" },
      },
    ]);

    const rows = await listSourceAppCredentials(ORG_ID, SOURCE_APP_ID);

    expect(rows[0]).toMatchObject({
      keyPrefix: KEY_PREFIX,
      keyLast4: KEY_LAST4,
      sourceAppName: "Mock Company AI Portal",
    });
    expect(JSON.stringify(rows)).not.toContain(KEY_HASH);
    expect(JSON.stringify(rows)).not.toContain(RAW_KEY);
  });

  it("scopes credential listing to organization", async () => {
    mockDb.aiSourceAppCredential.findMany.mockResolvedValue([]);

    await listSourceAppCredentials(ORG_ID);

    expect(mockDb.aiSourceAppCredential.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID },
      }),
    );
  });

  it("parses bearer token safely", () => {
    const result = parseBearerToken(`Bearer ${RAW_KEY}`);
    expect(result).toEqual({ ok: true, value: RAW_KEY });
  });
});
