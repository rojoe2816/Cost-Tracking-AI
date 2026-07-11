import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  modelProviderConnection: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

import {
  getOrganizationModelOptions,
  isOrganizationModelAllowed,
} from "./modelAccess";

describe("organization model access", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deduplicates models from active organization-scoped connections", async () => {
    mockDb.modelProviderConnection.findMany.mockResolvedValue([
      { providerType: "litellm", allowedModels: ["gpt-4o-mini", "shared"] },
      { providerType: "internal", allowedModels: ["shared", "company-v2"] },
    ]);

    expect(await getOrganizationModelOptions("org_a")).toEqual([
      { id: "gpt-4o-mini", label: "gpt-4o-mini", provider: "litellm" },
      { id: "shared", label: "shared", provider: "litellm" },
      { id: "company-v2", label: "company-v2", provider: "internal" },
    ]);
    expect(mockDb.modelProviderConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: "org_a", isActive: true } }),
    );
  });

  it("rejects models outside the active organization policy", async () => {
    mockDb.modelProviderConnection.findMany.mockResolvedValue([
      { providerType: "litellm", allowedModels: ["gpt-4o-mini"] },
    ]);

    expect(await isOrganizationModelAllowed("org_a", "org-b-model")).toBe(false);
  });
});
