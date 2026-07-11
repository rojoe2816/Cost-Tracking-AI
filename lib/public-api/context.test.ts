import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  organization: { findUnique: vi.fn() },
  employee: { findMany: vi.fn(), upsert: vi.fn() },
  client: { findMany: vi.fn(), upsert: vi.fn() },
  project: { findMany: vi.fn(), upsert: vi.fn() },
  workflowType: { findMany: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
}));
const mockModels = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("./modelAccess", () => ({
  getOrganizationModelOptions: mockModels,
}));

import { getPublicContext, syncProjects } from "./context";

describe("public context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.organization.findUnique.mockResolvedValue({ name: "Org A" });
    mockDb.employee.findMany.mockResolvedValue([
      {
        externalId: "emp-1",
        name: "Jordan",
        email: "jordan@example.com",
        department: "Success",
        role: "Manager",
      },
    ]);
    mockDb.client.findMany.mockResolvedValue([
      { externalId: "client-a", name: "Client A" },
    ]);
    mockDb.project.findMany.mockResolvedValue([
      {
        externalId: "project-a",
        name: "Project A",
        client: { externalId: "client-a" },
      },
    ]);
    mockDb.workflowType.findMany.mockResolvedValue([
      { externalId: "workflow-a", name: "Workflow A" },
    ]);
    mockModels.mockResolvedValue([
      { id: "gpt-4o-mini", label: "gpt-4o-mini", provider: "litellm" },
    ]);
    mockDb.$transaction.mockResolvedValue([]);
  });

  it("returns only external context and safe source-app metadata", async () => {
    const result = await getPublicContext({
      organizationId: "org_a",
      sourceAppId: "internal_app_id",
      credentialId: "internal_credential_id",
      sourceAppName: "Company AI",
      sourceAppType: "internal_ai",
      scopes: ["context:read"],
    });

    expect(result.projects[0]).toEqual({
      externalId: "project-a",
      clientExternalId: "client-a",
      name: "Project A",
    });
    expect(JSON.stringify(result)).not.toContain("internal_credential_id");
    expect(JSON.stringify(result)).not.toContain("keyHash");
  });

  it("rejects a project sync that references a client outside the organization", async () => {
    mockDb.client.findMany.mockResolvedValue([]);

    const result = await syncProjects("org_a", {
      projects: [
        {
          externalId: "project-b",
          clientExternalId: "org-b-client",
          name: "Project B",
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      code: "CLIENT_NOT_FOUND",
      message: "Client org-b-client was not found for this organization.",
    });
    expect(mockDb.project.upsert).not.toHaveBeenCalled();
  });
});
