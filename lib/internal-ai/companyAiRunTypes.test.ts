import { describe, expect, it } from "vitest";

import {
  COMPANY_AI_EXAMPLE_PROMPTS,
  COMPANY_AI_TASK_TYPES,
  validateCompanyAiRunBody,
} from "./companyAiRunTypes";

describe("companyAiRunTypes", () => {
  it("accepts a valid run body", () => {
    const result = validateCompanyAiRunBody({
      employeeId: "emp_1",
      clientId: "client_1",
      projectId: "project_1",
      workflowTypeId: "workflow_1",
      taskType: "client_update",
      model: "gpt-4o-mini",
      input: "Draft a one-sentence client update.",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects missing input", () => {
    const result = validateCompanyAiRunBody({
      employeeId: "emp_1",
      clientId: "client_1",
      projectId: "project_1",
      workflowTypeId: "workflow_1",
      taskType: "client_update",
      model: "gpt-4o-mini",
    });

    expect(result.ok).toBe(false);
  });

  it("includes expected task types and example prompts", () => {
    expect(COMPANY_AI_TASK_TYPES).toContain("project_risk_summary");
    expect(COMPANY_AI_EXAMPLE_PROMPTS).toHaveLength(5);
    expect(COMPANY_AI_EXAMPLE_PROMPTS.map((example) => example.taskType)).toContain(
      "sales_followup",
    );
  });
});
