import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  modelProviderConnection: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));
const mockEncrypt = vi.hoisted(() => vi.fn(() => "encrypted-value"));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/security/encryption", () => ({ encryptSecret: mockEncrypt }));

import { listModelConnections, saveModelConnection } from "./admin";

describe("model provider administration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("encrypts provider credentials and stores only model policy metadata", async () => {
    mockDb.modelProviderConnection.create.mockResolvedValue({ id: "connection-1" });

    await saveModelConnection({
      organizationId: "org_a",
      name: "Provider",
      providerType: "openai",
      endpointUrl: "https://api.example.com",
      credential: "provider-secret",
      allowedModels: "small-model, large-model",
    });

    expect(mockEncrypt).toHaveBeenCalledWith("provider-secret");
    expect(mockDb.modelProviderConnection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org_a",
        encryptedCredential: "encrypted-value",
        allowedModels: ["small-model", "large-model"],
      }),
    });
    expect(JSON.stringify(mockDb.modelProviderConnection.create.mock.calls)).not.toContain(
      "provider-secret",
    );
  });

  it("never returns encrypted credentials to the admin page", async () => {
    mockDb.modelProviderConnection.findMany.mockResolvedValue([
      {
        id: "connection-1",
        name: "Provider",
        providerType: "openai",
        endpointUrl: null,
        allowedModels: ["small-model"],
        isActive: true,
        lastValidatedAt: null,
        createdAt: new Date(),
        encryptedCredential: "encrypted-value",
      },
    ]);

    const result = await listModelConnections("org_a");
    expect(result[0]).toMatchObject({ hasCredential: true });
    expect(result[0]).not.toHaveProperty("encryptedCredential");
  });
});
