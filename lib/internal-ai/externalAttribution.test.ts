import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  employee: { findFirst: vi.fn() },
  client: { findFirst: vi.fn() },
  project: { findFirst: vi.fn() },
  workflowType: { findFirst: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { resolveGatewayAttributionIds } from "./externalAttribution";

describe("resolveGatewayAttributionIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.employee.findFirst.mockResolvedValue({ id: "employee_internal" });
    mockDb.client.findFirst.mockResolvedValue({ id: "client_internal" });
    mockDb.project.findFirst.mockResolvedValue({ id: "project_internal" });
    mockDb.workflowType.findFirst.mockResolvedValue({ id: "workflow_internal" });
  });

  it("resolves customer identifiers inside the authenticated organization", async () => {
    const result = await resolveGatewayAttributionIds({
      organizationId: "org_a",
      body: {
        employeeExternalId: "emp-104",
        clientExternalId: "client-acme",
        projectExternalId: "project-seo",
        workflowExternalId: "client-update",
        input: "Draft an update",
        model: "gpt-4o-mini",
      },
    });

    expect(result).toEqual({
      ok: true,
      value: {
        employeeId: "employee_internal",
        clientId: "client_internal",
        projectId: "project_internal",
        workflowTypeId: "workflow_internal",
      },
    });
    expect(mockDb.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org_a", externalId: "emp-104" },
      }),
    );
  });

  it("does not resolve a matching identifier from another organization", async () => {
    mockDb.employee.findFirst.mockResolvedValue(null);

    const result = await resolveGatewayAttributionIds({
      organizationId: "org_a",
      body: {
        employeeExternalId: "org-b-employee",
        input: "Draft an update",
        model: "gpt-4o-mini",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee was not found for this organization.",
      },
    });
  });

  it("rejects unknown client external IDs for this organization", async () => {
    mockDb.client.findFirst.mockResolvedValue(null);

    const result = await resolveGatewayAttributionIds({
      organizationId: "org_a",
      body: {
        clientExternalId: "client-from-org-b",
        input: "Draft an update",
        model: "gpt-4o-mini",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "CLIENT_NOT_FOUND",
        message: "Client was not found for this organization.",
      },
    });
  });

  it("rejects unknown project external IDs for this organization", async () => {
    mockDb.project.findFirst.mockResolvedValue(null);

    const result = await resolveGatewayAttributionIds({
      organizationId: "org_a",
      body: {
        projectExternalId: "project-from-org-b",
        input: "Draft an update",
        model: "gpt-4o-mini",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found for this organization.",
      },
    });
  });

  it("rejects unknown workflow external IDs for this organization", async () => {
    mockDb.workflowType.findFirst.mockResolvedValue(null);

    const result = await resolveGatewayAttributionIds({
      organizationId: "org_a",
      body: {
        workflowExternalId: "workflow-from-org-b",
        input: "Draft an update",
        model: "gpt-4o-mini",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "WORKFLOW_TYPE_NOT_FOUND",
        message: "Workflow type was not found for this organization.",
      },
    });
  });

  it("preserves the compatibility internal-ID path without external lookups", async () => {
    const result = await resolveGatewayAttributionIds({
      organizationId: "org_a",
      body: {
        employeeId: "employee_internal",
        input: "Draft an update",
        model: "gpt-4o-mini",
      },
    });

    expect(result.ok).toBe(true);
    expect(mockDb.employee.findFirst).not.toHaveBeenCalled();
  });
});
