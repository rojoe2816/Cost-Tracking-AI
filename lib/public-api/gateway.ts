import "server-only";

import { z } from "zod";

import { processInternalAiGatewayRequest } from "@/lib/internal-ai/gateway";
import {
  getDefaultGatewayModel,
  MAX_GATEWAY_INPUT_LENGTH,
} from "@/lib/internal-ai/gatewayTypes";

import { authenticatePublicApiAuthorizationHeader } from "./auth";
import { isOrganizationModelAllowed } from "./modelAccess";

const publicGatewayRequestSchema = z
  .object({
    employeeExternalId: z.string().trim().min(1).max(128),
    clientExternalId: z.string().trim().min(1).max(128).optional().nullable(),
    projectExternalId: z.string().trim().min(1).max(128).optional().nullable(),
    workflowExternalId: z.string().trim().min(1).max(128).optional().nullable(),
    taskType: z.string().trim().min(1).max(80).optional().nullable(),
    sourceAppRequestId: z.string().trim().min(1).max(128),
    model: z.string().trim().min(1).max(128).optional().nullable(),
    input: z.string().trim().min(1).max(MAX_GATEWAY_INPUT_LENGTH),
    metadata: z.record(z.string(), z.unknown()).optional(),
    attributionPrediction: z
      .object({
        predictedWorkflowExternalId: z.string().trim().min(1).max(128).optional().nullable(),
        predictedTaskType: z.string().trim().min(1).max(80).optional().nullable(),
        confidence: z.number().min(0).max(1).optional().nullable(),
        modelVersion: z.string().trim().min(1).max(128).optional().nullable(),
        wasOverridden: z.boolean().optional().nullable(),
        requiredReview: z.boolean().optional().nullable(),
      })
      .strict()
      .optional()
      .nullable(),
  })
  .strict();

export type PublicGatewayRequest = z.infer<typeof publicGatewayRequestSchema>;

export type PublicGatewayResponse = {
  requestId: string;
  response: string;
  usage: {
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costMicros: number;
    latencyMs: number;
  };
  attribution: {
    employeeExternalId: string;
    clientExternalId: string | null;
    projectExternalId: string | null;
    workflowExternalId: string | null;
    taskType: string | null;
    sourceAppRequestId: string;
  };
};

export type PublicGatewayResult =
  | { ok: true; status: 200; value: PublicGatewayResponse }
  | {
      ok: false;
      status: 400 | 401 | 403 | 409 | 500;
      value: { error: { code: string; message: string } };
    };

export async function processPublicGatewayRequest(input: {
  authorizationHeader: string | null;
  body: unknown;
}): Promise<PublicGatewayResult> {
  const parsed = publicGatewayRequestSchema.safeParse(input.body);

  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      value: {
        error: {
          code: "INVALID_BODY",
          message: parsed.error.issues[0]?.message ?? "Invalid request body.",
        },
      },
    };
  }

  const body = parsed.data;
  const auth = await authenticatePublicApiAuthorizationHeader(
    input.authorizationHeader,
    "ai:run",
  );

  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      value: { error: auth.error },
    };
  }

  const requestedModel = body.model?.trim() || getDefaultGatewayModel();
  const modelAllowed = await isOrganizationModelAllowed(
    auth.value.organizationId,
    requestedModel,
  );

  if (!modelAllowed) {
    return {
      ok: false,
      status: 400,
      value: {
        error: {
          code: "MODEL_NOT_ALLOWED",
          message: "The requested model is not enabled for this organization.",
        },
      },
    };
  }

  const gateway = await processInternalAiGatewayRequest({
    authorizationHeader: input.authorizationHeader,
    body: { ...body, model: requestedModel },
  });

  if (!gateway.ok) {
    return {
      ...gateway,
      value: {
        error: {
          code: gateway.value.error.code,
          message:
            gateway.value.error.code === "GATEWAY_PROCESSING_FAILED"
              ? "Slate could not complete the model request. Retry with the same sourceAppRequestId only after confirming the previous request failed."
              : gateway.value.error.message,
        },
      },
    };
  }

  return {
    ok: true,
    status: 200,
    value: {
      requestId: gateway.value.aiRequestAuditId,
      response: gateway.value.output,
      usage: {
        model: gateway.value.usage.model,
        provider: gateway.value.usage.provider,
        inputTokens: gateway.value.usage.promptTokens,
        outputTokens: gateway.value.usage.completionTokens,
        totalTokens: gateway.value.usage.totalTokens,
        costMicros: gateway.value.usage.costMicros,
        latencyMs: gateway.value.usage.latencyMs,
      },
      attribution: {
        employeeExternalId: body.employeeExternalId,
        clientExternalId: body.clientExternalId ?? null,
        projectExternalId: body.projectExternalId ?? null,
        workflowExternalId: body.workflowExternalId ?? null,
        taskType: body.taskType?.trim().toLowerCase() ?? null,
        sourceAppRequestId: body.sourceAppRequestId,
      },
    },
  };
}
