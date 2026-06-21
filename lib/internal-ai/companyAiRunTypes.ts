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
    label: "Draft a one-sentence client update.",
    taskType: "client_update" as const,
    input: "Draft a one-sentence client update.",
  },
  {
    label: "Summarize a support issue in one sentence.",
    taskType: "support_summary" as const,
    input: "Summarize a support issue in one sentence.",
  },
  {
    label: "Write a short project risk note.",
    taskType: "project_risk_summary" as const,
    input: "Write a short project risk note.",
  },
  {
    label: "Generate a short internal research note.",
    taskType: "research_note" as const,
    input: "Generate a short internal research note.",
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
