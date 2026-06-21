import { z } from "zod";

export const COMPANY_AI_TASK_TYPES = [
  "client_update",
  "support_summary",
  "sales_followup",
  "research_note",
  "project_risk_summary",
] as const;

export type CompanyAiTaskType = (typeof COMPANY_AI_TASK_TYPES)[number];

export const COMPANY_AI_EXAMPLE_PROMPTS = [
  {
    label: "Client update",
    hint: "One-sentence client status update",
    taskType: "client_update" as const,
    input: "Reply in one short sentence: The client update is ready for review.",
  },
  {
    label: "Support summary",
    hint: "One-sentence support triage summary",
    taskType: "support_summary" as const,
    input: "Reply in one short sentence: Three support tickets were summarized.",
  },
  {
    label: "Sales follow-up",
    hint: "One-sentence sales follow-up draft",
    taskType: "sales_followup" as const,
    input: "Reply in one short sentence: The sales follow-up email draft is ready.",
  },
  {
    label: "Research note",
    hint: "One-sentence internal research note",
    taskType: "research_note" as const,
    input: "Reply in one short sentence: The internal research note was generated.",
  },
  {
    label: "Project risk summary",
    hint: "One-sentence project risk note",
    taskType: "project_risk_summary" as const,
    input: "Reply in one short sentence: The project risk summary is ready.",
  },
] as const;

export const companyAiRunRequestSchema = z
  .object({
    employeeId: z.string().trim().min(1),
    clientId: z.string().trim().min(1),
    projectId: z.string().trim().min(1),
    workflowTypeId: z.string().trim().min(1),
    taskType: z.enum(COMPANY_AI_TASK_TYPES),
    model: z.string().trim().min(1),
    input: z.string().trim().min(1).max(16_000),
  })
  .strict();

export type CompanyAiRunRequest = z.infer<typeof companyAiRunRequestSchema>;

export type CompanyAiRunValidationResult =
  | { ok: true; value: CompanyAiRunRequest }
  | { ok: false; error: { code: string; message: string } };

export function validateCompanyAiRunBody(body: unknown): CompanyAiRunValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      error: { code: "INVALID_BODY", message: "Request body must be a JSON object." },
    };
  }

  const parsed = companyAiRunRequestSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body.";
    return {
      ok: false,
      error: { code: "INVALID_BODY", message },
    };
  }

  return { ok: true, value: parsed.data };
}

export type CompanyAiRunSuccessResponse = {
  aiRequestAuditId: string;
  output: string;
  usage: {
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    spendUsd: number;
    externalLiteLlmRequestId: string | null;
    latencyMs: number;
  };
  attribution: {
    employeeId: string;
    clientId: string;
    projectId: string;
    workflowTypeId: string;
    taskType: CompanyAiTaskType;
    sourceAppRequestId: string;
  };
};

export type CompanyAiRunErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

export type CompanyAiRunResult =
  | { ok: true; status: 200; value: CompanyAiRunSuccessResponse }
  | {
      ok: false;
      status: 400 | 401 | 403 | 409 | 500 | 503;
      value: CompanyAiRunErrorResponse;
    };
