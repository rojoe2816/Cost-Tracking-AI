import "server-only";

import {
  createAiUsageEvent,
  createProcessingAiRequestAudit,
  markAiRequestCompleted,
  markAiRequestFailed,
} from "@/lib/ai/requests";
import { microsToUsdDecimal, usdToMicros } from "@/lib/db/costs";
import { db } from "@/lib/db";
import { sendLiteLlmChatCompletion } from "@/lib/litellm/client";
import { resolveLiteLlmCompletionForPersistence } from "@/lib/litellm/resolveCompletion";
import { logger } from "@/lib/logger";

import {
  type InternalAiGatewayErrorResponse,
  type InternalAiGatewaySuccessResponse,
  validateInternalAiGatewayBody,
} from "./gatewayTypes";
import { resolveGatewayAttributionIds } from "./externalAttribution";
import {
  authenticateSourceAppRequest,
  parseBearerToken,
  type SourceAppAuthErrorCode,
} from "./sourceAppAuth";
import { hasSourceAppScope } from "./sourceAppScopes";
import { validateInternalAiAttribution } from "./usageAttribution";

const MAX_ERROR_MESSAGE_LENGTH = 1000;

export type InternalAiGatewayResult =
  | { ok: true; status: 200; value: InternalAiGatewaySuccessResponse }
  | {
      ok: false;
      status: 400 | 401 | 403 | 409 | 500;
      value: InternalAiGatewayErrorResponse;
    };

function authErrorStatus(code: SourceAppAuthErrorCode): 401 | 403 {
  switch (code) {
    case "CREDENTIAL_INACTIVE":
    case "CREDENTIAL_REVOKED":
    case "SOURCE_APP_INACTIVE":
      return 403;
    default:
      return 401;
  }
}

function fail(
  status: 400 | 401 | 403 | 409 | 500,
  code: string,
  message: string,
): InternalAiGatewayResult {
  return {
    ok: false,
    status,
    value: { error: { code, message } },
  };
}

async function findDuplicateSourceAppRequest(input: {
  organizationId: string;
  sourceAppId: string;
  sourceAppRequestId: string;
}) {
  return db.aiRequestAudit.findFirst({
    where: {
      organizationId: input.organizationId,
      sourceAppId: input.sourceAppId,
      sourceAppRequestId: input.sourceAppRequestId,
      status: {
        in: ["PROCESSING", "COMPLETED"],
      },
    },
    select: {
      id: true,
      status: true,
    },
  });
}

function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, MAX_ERROR_MESSAGE_LENGTH);
  }

  return "Internal AI gateway request failed".slice(0, MAX_ERROR_MESSAGE_LENGTH);
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002",
  );
}

/**
 * Synchronous internal AI gateway for company-native tools.
 * Unlike Slack events, this path returns the model response directly to the caller.
 */
export async function processInternalAiGatewayRequest(input: {
  authorizationHeader: string | null | undefined;
  body: unknown;
}): Promise<InternalAiGatewayResult> {
  const bearer = parseBearerToken(input.authorizationHeader);

  if (!bearer.ok) {
    return fail(401, bearer.error.code, bearer.error.message);
  }

  const auth = await authenticateSourceAppRequest(bearer.value);

  if (!auth.ok) {
    return fail(authErrorStatus(auth.error.code), auth.error.code, auth.error.message);
  }

  if (!hasSourceAppScope(auth.value.scopes, "ai:run")) {
    return fail(
      403,
      "INSUFFICIENT_SCOPE",
      "API credential requires the ai:run scope.",
    );
  }

  const validatedBody = validateInternalAiGatewayBody(input.body);

  if (!validatedBody.ok) {
    return fail(400, validatedBody.error.code, validatedBody.error.message);
  }

  const body = validatedBody.value;

  const resolvedAttribution = await resolveGatewayAttributionIds({
    organizationId: auth.value.organizationId,
    body,
  });

  if (!resolvedAttribution.ok) {
    return fail(
      400,
      resolvedAttribution.error.code,
      resolvedAttribution.error.message,
    );
  }

  const attribution = await validateInternalAiAttribution({
    organizationId: auth.value.organizationId,
    employeeId: resolvedAttribution.value.employeeId,
    sourceAppId: auth.value.sourceAppId,
    clientId: resolvedAttribution.value.clientId,
    projectId: resolvedAttribution.value.projectId,
    workflowTypeId: resolvedAttribution.value.workflowTypeId,
    taskType: body.taskType ?? null,
  });

  if (!attribution.ok) {
    return fail(400, attribution.error.code, attribution.error.message);
  }

  if (body.sourceAppRequestId) {
    const duplicate = await findDuplicateSourceAppRequest({
      organizationId: auth.value.organizationId,
      sourceAppId: auth.value.sourceAppId,
      sourceAppRequestId: body.sourceAppRequestId,
    });

    if (duplicate) {
      return fail(
        409,
        "DUPLICATE_SOURCE_APP_REQUEST",
        "Request with this sourceAppRequestId was already processed or is in progress.",
      );
    }
  }

  let audit: { id: string };

  try {
    audit = await createProcessingAiRequestAudit({
      organizationId: auth.value.organizationId,
      source: "WEB",
      employeeId: attribution.value.employeeId,
      sourceAppId: auth.value.sourceAppId,
      clientId: attribution.value.clientId,
      projectId: attribution.value.projectId,
      workflowTypeId: attribution.value.workflowTypeId,
      taskType: attribution.value.taskType,
      sourceAppRequestId: body.sourceAppRequestId ?? null,
    });
  } catch (error) {
    if (body.sourceAppRequestId && isUniqueConstraintError(error)) {
      return fail(
        409,
        "DUPLICATE_SOURCE_APP_REQUEST",
        "Request with this sourceAppRequestId was already processed or is in progress.",
      );
    }
    throw error;
  }

  const startedAt = Date.now();

  try {
    const completion = await sendLiteLlmChatCompletion({
      model: body.model,
      messages: [
        {
          role: "user",
          content: body.input,
        },
      ],
      metadata: {
        organization_id: auth.value.organizationId,
        source: "web",
        app_request_id: audit.id,
        ...(attribution.value.clientId
          ? { client_id: attribution.value.clientId }
          : {}),
        ...(attribution.value.projectId
          ? { project_id: attribution.value.projectId }
          : {}),
        ...(attribution.value.workflowTypeId
          ? { workflow_type_id: attribution.value.workflowTypeId }
          : {}),
      },
    });

    const latencyMs = Date.now() - startedAt;
    const resolvedCompletion = await resolveLiteLlmCompletionForPersistence({
      aiRequestAuditId: audit.id,
      completion,
      organizationId: auth.value.organizationId,
    });

    await markAiRequestCompleted(audit.id, resolvedCompletion.externalLiteLlmRequestId);

    const totalCostMicros =
      resolvedCompletion.costUsd !== undefined
        ? usdToMicros(resolvedCompletion.costUsd)
        : 0n;

    await createAiUsageEvent({
      organizationId: auth.value.organizationId,
      aiRequestAuditId: audit.id,
      source: "WEB",
      provider: resolvedCompletion.provider,
      model: resolvedCompletion.model,
      promptTokens: resolvedCompletion.usage.inputTokens,
      completionTokens: resolvedCompletion.usage.outputTokens,
      totalTokens: resolvedCompletion.usage.totalTokens,
      totalCostMicros,
      latencyMs,
      ...(resolvedCompletion.externalLiteLlmRequestId
        ? { externalLiteLlmRequestId: resolvedCompletion.externalLiteLlmRequestId }
        : {}),
      clientId: attribution.value.clientId,
      projectId: attribution.value.projectId,
      workflowTypeId: attribution.value.workflowTypeId,
      employeeId: attribution.value.employeeId,
      sourceAppId: auth.value.sourceAppId,
      taskType: attribution.value.taskType,
    });

    logger.info(
      {
        aiRequestAuditId: audit.id,
        organizationId: auth.value.organizationId,
        sourceAppId: auth.value.sourceAppId,
        credentialId: auth.value.credentialId,
        model: resolvedCompletion.model,
        provider: resolvedCompletion.provider,
        latencyMs,
        inputTokens: resolvedCompletion.usage.inputTokens,
        outputTokens: resolvedCompletion.usage.outputTokens,
        totalTokens: resolvedCompletion.usage.totalTokens,
        externalLiteLlmRequestId: resolvedCompletion.externalLiteLlmRequestId,
      },
      "Internal AI gateway request completed",
    );

    return {
      ok: true,
      status: 200,
      value: {
        aiRequestAuditId: audit.id,
        output: resolvedCompletion.content,
        usage: {
          provider: resolvedCompletion.provider,
          model: resolvedCompletion.model,
          promptTokens: resolvedCompletion.usage.inputTokens,
          completionTokens: resolvedCompletion.usage.outputTokens,
          totalTokens: resolvedCompletion.usage.totalTokens,
          costMicros: Number(totalCostMicros),
          spendUsd: microsToUsdDecimal(totalCostMicros).toNumber(),
          externalLiteLlmRequestId:
            resolvedCompletion.externalLiteLlmRequestId ?? null,
          latencyMs,
        },
        attribution: {
          organizationId: auth.value.organizationId,
          sourceAppId: auth.value.sourceAppId,
          employeeId: attribution.value.employeeId,
          clientId: attribution.value.clientId,
          projectId: attribution.value.projectId,
          workflowTypeId: attribution.value.workflowTypeId,
          taskType: attribution.value.taskType,
          sourceAppRequestId: body.sourceAppRequestId ?? null,
        },
      },
    };
  } catch (error) {
    const errorMessage = sanitizeErrorMessage(error);
    await markAiRequestFailed(audit.id, errorMessage);

    logger.error(
      {
        err: errorMessage,
        aiRequestAuditId: audit.id,
        organizationId: auth.value.organizationId,
        sourceAppId: auth.value.sourceAppId,
      },
      "Internal AI gateway request failed",
    );

    return fail(500, "GATEWAY_PROCESSING_FAILED", errorMessage);
  }
}
