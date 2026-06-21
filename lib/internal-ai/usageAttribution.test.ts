import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
  },
  employee: {
    findFirst: vi.fn(),
  },
  aiSourceApp: {
    findFirst: vi.fn(),
  },
  client: {
    findFirst: vi.fn(),
  },
  project: {
    findFirst: vi.fn(),
  },
  workflowType: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

import { validateInternalAiAttribution } from "./usageAttribution";

const ORG_ID = "org_demo";
const EMPLOYEE_ID = "emp_1";
const SOURCE_APP_ID = "app_1";
const CLIENT_ID = "client_1";
const PROJECT_ID = "project_1";
const WORKFLOW_ID = "workflow_1";

describe("validateInternalAiAttribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.organization.findUnique.mockResolvedValue({ id: ORG_ID });
    mockDb.employee.findFirst.mockResolvedValue({ id: EMPLOYEE_ID, isActive: true });
    mockDb.aiSourceApp.findFirst.mockResolvedValue({ id: SOURCE_APP_ID, isActive: true });
    mockDb.client.findFirst.mockResolvedValue({ id: CLIENT_ID });
    mockDb.project.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      clientId: CLIENT_ID,
    });
    mockDb.workflowType.findFirst.mockResolvedValue({ id: WORKFLOW_ID });
  });

  it("passes when employee, source app, client, project, and workflow are valid", async () => {
    const result = await validateInternalAiAttribution({
      organizationId: ORG_ID,
      employeeId: EMPLOYEE_ID,
      sourceAppId: SOURCE_APP_ID,
      clientId: CLIENT_ID,
      projectId: PROJECT_ID,
      workflowTypeId: WORKFLOW_ID,
      taskType: "Client Update",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        organizationId: ORG_ID,
        employeeId: EMPLOYEE_ID,
        sourceAppId: SOURCE_APP_ID,
        clientId: CLIENT_ID,
        projectId: PROJECT_ID,
        workflowTypeId: WORKFLOW_ID,
        taskType: "client update",
      },
    });
  });

  it("passes when optional employee and source app are omitted", async () => {
    const result = await validateInternalAiAttribution({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.employeeId).toBeNull();
      expect(result.value.sourceAppId).toBeNull();
    }
  });

  it("rejects cross-org employee", async () => {
    mockDb.employee.findFirst.mockResolvedValue(null);

    const result = await validateInternalAiAttribution({
      organizationId: ORG_ID,
      employeeId: EMPLOYEE_ID,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "EMPLOYEE_NOT_FOUND",
        message: "Employee not found for this organization.",
      },
    });
  });

  it("rejects inactive employee", async () => {
    mockDb.employee.findFirst.mockResolvedValue({ id: EMPLOYEE_ID, isActive: false });

    const result = await validateInternalAiAttribution({
      organizationId: ORG_ID,
      employeeId: EMPLOYEE_ID,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "EMPLOYEE_INACTIVE",
        message: "Employee is inactive.",
      },
    });
  });

  it("rejects cross-org source app", async () => {
    mockDb.aiSourceApp.findFirst.mockResolvedValue(null);

    const result = await validateInternalAiAttribution({
      organizationId: ORG_ID,
      sourceAppId: SOURCE_APP_ID,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "SOURCE_APP_NOT_FOUND",
        message: "Source app not found for this organization.",
      },
    });
  });

  it("rejects inactive source app", async () => {
    mockDb.aiSourceApp.findFirst.mockResolvedValue({ id: SOURCE_APP_ID, isActive: false });

    const result = await validateInternalAiAttribution({
      organizationId: ORG_ID,
      sourceAppId: SOURCE_APP_ID,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "SOURCE_APP_INACTIVE",
        message: "Source app is inactive.",
      },
    });
  });

  it("rejects cross-org client", async () => {
    mockDb.client.findFirst.mockResolvedValue(null);

    const result = await validateInternalAiAttribution({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "CLIENT_NOT_FOUND",
        message: "Client not found for this organization.",
      },
    });
  });

  it("rejects cross-org project", async () => {
    mockDb.project.findFirst.mockResolvedValue(null);

    const result = await validateInternalAiAttribution({
      organizationId: ORG_ID,
      projectId: PROJECT_ID,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "PROJECT_NOT_FOUND",
        message: "Project not found for this organization.",
      },
    });
  });

  it("rejects project that does not belong to the selected client", async () => {
    mockDb.project.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      clientId: "other_client",
    });

    const result = await validateInternalAiAttribution({
      organizationId: ORG_ID,
      clientId: CLIENT_ID,
      projectId: PROJECT_ID,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "PROJECT_CLIENT_MISMATCH",
        message: "Project does not belong to the selected client.",
      },
    });
  });

  it("rejects cross-org workflow type", async () => {
    mockDb.workflowType.findFirst.mockResolvedValue(null);

    const result = await validateInternalAiAttribution({
      organizationId: ORG_ID,
      workflowTypeId: WORKFLOW_ID,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "WORKFLOW_TYPE_NOT_FOUND",
        message: "Workflow type not found for this organization.",
      },
    });
  });

  it("normalizes task type to lowercase trimmed text", async () => {
    const result = await validateInternalAiAttribution({
      organizationId: ORG_ID,
      taskType: "  Proposal Draft  ",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.taskType).toBe("proposal draft");
    }
  });

  it("rejects prompt or response text fields", async () => {
    const result = await validateInternalAiAttribution({
      organizationId: ORG_ID,
      promptText: "DO_NOT_STORE",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "PROMPT_OR_RESPONSE_NOT_ALLOWED",
        message: "Prompt and response text are not accepted by attribution validation.",
      },
    });
  });
});
