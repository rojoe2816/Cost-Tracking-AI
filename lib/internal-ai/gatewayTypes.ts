import { z } from "zod";

const FORBIDDEN_BODY_KEYS = [
  "promptText",
  "responseText",
  "rawPrompt",
  "rawResponse",
  "storePrompt",
  "storeResponse",
] as const;

export const MAX_GATEWAY_INPUT_LENGTH = 16_000;

export const internalAiGatewayRequestSchema = z
  .object({
    employeeId: z.string().trim().min(1).optional().nullable(),
    clientId: z.string().trim().min(1).optional().nullable(),
    projectId: z.string().trim().min(1).optional().nullable(),
    workflowTypeId: z.string().trim().min(1).optional().nullable(),
    taskType: z.string().trim().min(1).max(80).optional().nullable(),
    sourceAppRequestId: z.string().trim().min(1).max(128).optional().nullable(),
    model: z.string().trim().min(1).optional().nullable(),
    input: z.string().trim().min(1).max(MAX_GATEWAY_INPUT_LENGTH),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type InternalAiGatewayRequest = z.infer<typeof internalAiGatewayRequestSchema>;

export type InternalAiGatewayValidationResult =
  | { ok: true; value: InternalAiGatewayRequest & { model: string } }
  | { ok: false; error: { code: string; message: string } };

export function getDefaultGatewayModel(): string {
  return process.env.LITELLM_DEFAULT_MODEL?.trim() || "gpt-4o-mini";
}

export function validateInternalAiGatewayBody(
  body: unknown,
): InternalAiGatewayValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      error: { code: "INVALID_BODY", message: "Request body must be a JSON object." },
    };
  }

  for (const key of FORBIDDEN_BODY_KEYS) {
    if (key in body) {
      return {
        ok: false,
        error: {
          code: "PROMPT_OR_RESPONSE_NOT_ALLOWED",
          message: "Prompt and response storage fields are not accepted.",
        },
      };
    }
  }

  const parsed = internalAiGatewayRequestSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body.";
    return {
      ok: false,
      error: { code: "INVALID_BODY", message },
    };
  }

  return {
    ok: true,
    value: {
      ...parsed.data,
      model: parsed.data.model?.trim() || getDefaultGatewayModel(),
    },
  };
}

export type InternalAiGatewaySuccessResponse = {
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
    organizationId: string;
    sourceAppId: string;
    employeeId: string | null;
    clientId: string | null;
    projectId: string | null;
    workflowTypeId: string | null;
    taskType: string | null;
    sourceAppRequestId: string | null;
  };
};

export type InternalAiGatewayErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};
