import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  employee: {
    findMany: vi.fn(),
  },
  client: {
    findMany: vi.fn(),
  },
  project: {
    findMany: vi.fn(),
  },
  workflowType: {
    findMany: vi.fn(),
  },
  aiSourceApp: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

import { getInternalAiContextOptions } from "./context";

const ORG_A = "org_a";
const ORG_B = "org_b";

describe("getInternalAiContextOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.employee.findMany.mockResolvedValue([
      {
        id: "emp_1",
        name: "Tucker Hawkins",
        email: "tucker@demo-agency.test",
        department: "Operations",
        role: "Director",
      },
    ]);
    mockDb.client.findMany.mockResolvedValue([{ id: "client_1", name: "Acme Dental" }]);
    mockDb.project.findMany.mockResolvedValue([
      { id: "project_1", name: "SEO Retainer", clientId: "client_1" },
    ]);
    mockDb.workflowType.findMany.mockResolvedValue([
      { id: "workflow_1", name: "Client Update" },
    ]);
    mockDb.aiSourceApp.findMany.mockResolvedValue([
      {
        id: "app_1",
        name: "Mock Company AI Portal",
        type: "mock_company_portal",
        description: "Demo portal",
      },
    ]);
  });

  it("returns employees only from the requested organization", async () => {
    await getInternalAiContextOptions(ORG_A);

    expect(mockDb.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_A, isActive: true },
      }),
    );
  });

  it("returns active source apps only", async () => {
    await getInternalAiContextOptions(ORG_A);

    expect(mockDb.aiSourceApp.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_A, isActive: true },
      }),
    );
  });

  it("returns clients, projects, and workflows scoped to the organization", async () => {
    await getInternalAiContextOptions(ORG_B);

    expect(mockDb.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG_B, status: "ACTIVE" } }),
    );
    expect(mockDb.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG_B, status: "ACTIVE" } }),
    );
    expect(mockDb.workflowType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG_B } }),
    );
  });

  it("returns no secrets in the response payload", async () => {
    const options = await getInternalAiContextOptions(ORG_A);
    const serialized = JSON.stringify(options);

    expect(serialized).not.toMatch(/xoxb-/);
    expect(serialized).not.toMatch(/sk-/);
    expect(serialized).not.toMatch(/ENCRYPTION_KEY/);
    expect(serialized).not.toMatch(/SLACK_/);
  });

  it("handles an organization with no employees or source apps safely", async () => {
    mockDb.employee.findMany.mockResolvedValue([]);
    mockDb.aiSourceApp.findMany.mockResolvedValue([]);

    const options = await getInternalAiContextOptions(ORG_A);

    expect(options.employees).toEqual([]);
    expect(options.sourceApps).toEqual([]);
    expect(options.clients.length).toBeGreaterThan(0);
  });

  it("includes at least one model option", async () => {
    const options = await getInternalAiContextOptions(ORG_A);

    expect(options.models.length).toBeGreaterThan(0);
    expect(options.models[0]).toMatchObject({
      id: expect.any(String),
      label: expect.any(String),
      provider: expect.any(String),
    });
  });
});
