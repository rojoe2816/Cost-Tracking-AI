import "server-only";

import { randomUUID } from "node:crypto";

import { env } from "@/lib/env";
import { truncateLiteLlmRequestId } from "@/lib/analytics/usage";

import { processInternalAiGatewayRequest } from "./gateway";
import {
  type CompanyAiRunResult,
  validateCompanyAiRunBody,
} from "./companyAiRunTypes";

function fail(
  status: 400 | 401 | 403 | 409 | 500 | 503,
  code: string,
  message: string,
): CompanyAiRunResult {
  return {
    ok: false,
    status,
    value: { error: { code, message } },
  };
}

/**
 * Server-side bridge from the mock company AI portal to the Slate gateway.
 * Reads the source app key from env and never exposes it to callers.
 */
export async function runCompanyAiTask(body: unknown): Promise<CompanyAiRunResult> {
  const sourceAppKey = env.MOCK_COMPANY_SOURCE_APP_KEY?.trim();

  if (!sourceAppKey) {
    return fail(
      503,
      "SOURCE_APP_KEY_NOT_CONFIGURED",
      "MOCK_COMPANY_SOURCE_APP_KEY is not configured. Create a dev key and add it to local .env.",
    );
  }

  const validatedBody = validateCompanyAiRunBody(body);

  if (!validatedBody.ok) {
    return fail(400, validatedBody.error.code, validatedBody.error.message);
  }

  const sourceAppRequestId = `company-ai-${randomUUID()}`;
  const gatewayResult = await processInternalAiGatewayRequest({
    authorizationHeader: `Bearer ${sourceAppKey}`,
    body: {
      employeeId: validatedBody.value.employeeId,
      clientId: validatedBody.value.clientId,
      projectId: validatedBody.value.projectId,
      workflowTypeId: validatedBody.value.workflowTypeId,
      taskType: validatedBody.value.taskType,
      model: validatedBody.value.model,
      input: validatedBody.value.input,
      sourceAppRequestId,
    },
  });

  if (!gatewayResult.ok) {
    return {
      ok: false,
      status: gatewayResult.status,
      value: gatewayResult.value,
    };
  }

  const { value } = gatewayResult;

  return {
    ok: true,
    status: 200,
    value: {
      aiRequestAuditId: value.aiRequestAuditId,
      output: value.output,
      usage: {
        provider: value.usage.provider,
        model: value.usage.model,
        promptTokens: value.usage.promptTokens,
        completionTokens: value.usage.completionTokens,
        totalTokens: value.usage.totalTokens,
        spendUsd: value.usage.spendUsd,
        externalLiteLlmRequestId: value.usage.externalLiteLlmRequestId
          ? truncateLiteLlmRequestId(value.usage.externalLiteLlmRequestId)
          : null,
        latencyMs: value.usage.latencyMs,
      },
      attribution: {
        employeeId: validatedBody.value.employeeId,
        clientId: validatedBody.value.clientId,
        projectId: validatedBody.value.projectId,
        workflowTypeId: validatedBody.value.workflowTypeId,
        taskType: validatedBody.value.taskType,
        sourceAppRequestId,
      },
    },
  };
}

export function isCompanyAiGatewayConfigured(): boolean {
  return Boolean(env.MOCK_COMPANY_SOURCE_APP_KEY?.trim());
}
