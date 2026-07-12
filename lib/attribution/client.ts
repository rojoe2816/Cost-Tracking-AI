import "server-only";

import { env } from "@/lib/env";

export type ClassificationResult = {
  workflowExternalId: string;
  workflowLabel: string;
  taskType: string;
  confidence: number;
  alternatives: Array<{
    workflowExternalId: string;
    taskType: string;
    confidence: number;
  }>;
  modelVersion: string;
  requiresReview: boolean;
};

export type AttributionEvaluation = {
  modelVersion: string;
  holdoutSamples: number;
  workflowAccuracy: number;
  workflowMacroF1: number;
  workflowTop2Accuracy: number;
  taskTypeAccuracy: number;
  taskTypeMacroF1: number;
  taskTypeTop2Accuracy: number;
};

export class AttributionClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "AttributionClientError";
  }
}

export async function classifyAttribution(input: {
  text: string;
  organizationId?: string;
  allowedWorkflows: Array<{ externalId: string; name: string }>;
  allowedTaskTypes: string[];
}): Promise<ClassificationResult> {
  const baseUrl = env.ATTRIBUTION_SERVICE_URL?.replace(/\/$/, "");
  const token = env.ATTRIBUTION_SERVICE_TOKEN;

  if (!baseUrl || !token) {
    throw new AttributionClientError(
      "Attribution service is not configured.",
      "ATTRIBUTION_NOT_CONFIGURED",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/classify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organizationId: input.organizationId,
        text: input.text,
        allowedWorkflows: input.allowedWorkflows,
        allowedTaskTypes: input.allowedTaskTypes,
      }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new AttributionClientError(
      "Attribution service is unavailable.",
      "ATTRIBUTION_UNAVAILABLE",
    );
  }

  if (!response.ok) {
    throw new AttributionClientError(
      "Attribution service rejected the request.",
      "ATTRIBUTION_REJECTED",
    );
  }

  const body = (await response.json()) as ClassificationResult;
  if (
    !body.workflowExternalId ||
    !body.taskType ||
    typeof body.confidence !== "number" ||
    !body.modelVersion
  ) {
    throw new AttributionClientError(
      "Attribution service returned an invalid payload.",
      "ATTRIBUTION_INVALID_RESPONSE",
    );
  }

  return body;
}

export async function evaluateAttributionClassifier(): Promise<AttributionEvaluation> {
  const baseUrl = env.ATTRIBUTION_SERVICE_URL?.replace(/\/$/, "");
  const token = env.ATTRIBUTION_SERVICE_TOKEN;
  if (!baseUrl || !token) {
    throw new AttributionClientError(
      "Attribution service is not configured.",
      "ATTRIBUTION_NOT_CONFIGURED",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/v1/evaluate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    throw new AttributionClientError(
      "Attribution service is unavailable.",
      "ATTRIBUTION_UNAVAILABLE",
    );
  }

  if (!response.ok) {
    throw new AttributionClientError(
      "Attribution service rejected the request.",
      "ATTRIBUTION_REJECTED",
    );
  }

  const body = (await response.json()) as AttributionEvaluation;
  if (
    !body.modelVersion ||
    typeof body.workflowMacroF1 !== "number" ||
    typeof body.taskTypeMacroF1 !== "number" ||
    typeof body.workflowTop2Accuracy !== "number" ||
    typeof body.taskTypeTop2Accuracy !== "number"
  ) {
    throw new AttributionClientError(
      "Attribution service returned an invalid payload.",
      "ATTRIBUTION_INVALID_RESPONSE",
    );
  }
  return body;
}
