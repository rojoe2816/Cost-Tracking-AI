import { describe, expect, it } from "vitest";

import { COMPANY_AI_TASK_TYPES } from "@/lib/internal-ai/companyAiRunTypes";

describe("company-ai page integration", () => {
  it("defines the task types used by the company AI workspace", () => {
    expect(COMPANY_AI_TASK_TYPES).toEqual([
      "client_update",
      "support_summary",
      "sales_followup",
      "research_note",
      "project_risk_summary",
    ]);
  });

  it("registers the company AI route in dashboard navigation", async () => {
    const { dashboardNavigation } = await import("@/lib/navigation");
    expect(dashboardNavigation[0]?.href).toBe("/company-ai");
    expect(
      dashboardNavigation.some((item) => item.href === "/company-ai"),
    ).toBe(true);
  });
});
