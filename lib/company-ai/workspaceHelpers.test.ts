import { describe, expect, it } from "vitest";

import {
  canSubmitCompanyAiTask,
  getDefaultProjectIdForClient,
  getProjectOptionsForClient,
} from "./workspaceHelpers";

const CONTEXT = {
  employees: [],
  clients: [{ id: "client_1", name: "Acme Dental" }],
  projects: [
    { id: "project_1", name: "SEO Retainer", clientId: "client_1" },
    { id: "project_2", name: "Other Project", clientId: "client_2" },
  ],
  workflowTypes: [],
  sourceApps: [],
  models: [],
};

describe("workspaceHelpers", () => {
  it("filters projects by client", () => {
    expect(getProjectOptionsForClient(CONTEXT, "client_1")).toEqual([
      { id: "project_1", label: "SEO Retainer" },
    ]);
  });

  it("selects the first project for a client", () => {
    expect(getDefaultProjectIdForClient(CONTEXT, "client_1")).toBe("project_1");
  });

  it("requires gateway config, attribution, and prompt before submit", () => {
    expect(
      canSubmitCompanyAiTask({
        gatewayConfigured: true,
        loading: false,
        employeeId: "emp_1",
        clientId: "client_1",
        projectId: "project_1",
        workflowTypeId: "workflow_1",
        input: "hello",
      }),
    ).toBe(true);

    expect(
      canSubmitCompanyAiTask({
        gatewayConfigured: false,
        loading: false,
        employeeId: "emp_1",
        clientId: "client_1",
        projectId: "project_1",
        workflowTypeId: "workflow_1",
        input: "hello",
      }),
    ).toBe(false);
  });
});
