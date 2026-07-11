import "server-only";

import { db } from "@/lib/db";

export type AttributionPredictionInput = {
  predictedWorkflowExternalId?: string | null | undefined;
  predictedTaskType?: string | null | undefined;
  confidence?: number | null | undefined;
  modelVersion?: string | null | undefined;
  wasOverridden?: boolean | null | undefined;
  requiredReview?: boolean | null | undefined;
};

export async function createAiAttributionDecision(input: {
  organizationId: string;
  aiRequestAuditId: string;
  sourceAppId: string;
  employeeId?: string | null | undefined;
  finalWorkflowTypeId: string;
  finalTaskType: string;
  prediction?: AttributionPredictionInput | null | undefined;
  predictedWorkflowTypeId?: string | null | undefined;
}): Promise<void> {
  const predictedTaskType = input.prediction?.predictedTaskType ?? null;
  const wasOverridden =
    input.prediction?.wasOverridden ??
    Boolean(
      predictedTaskType &&
        predictedTaskType !== input.finalTaskType,
    );

  await db.aiAttributionDecision.create({
    data: {
      organizationId: input.organizationId,
      aiRequestAuditId: input.aiRequestAuditId,
      sourceAppId: input.sourceAppId,
      employeeId: input.employeeId ?? null,
      predictedWorkflowTypeId: input.predictedWorkflowTypeId ?? null,
      predictedTaskType,
      predictedConfidence:
        typeof input.prediction?.confidence === "number"
          ? input.prediction.confidence
          : null,
      modelVersion: input.prediction?.modelVersion ?? null,
      finalWorkflowTypeId: input.finalWorkflowTypeId,
      finalTaskType: input.finalTaskType,
      wasOverridden,
      requiredReview: Boolean(input.prediction?.requiredReview),
    },
  });
}

export async function getAttributionQualityReport(organizationId: string) {
  const [total, overridden, lowConfidence, activeModel, trainingCount] =
    await Promise.all([
      db.aiAttributionDecision.count({ where: { organizationId } }),
      db.aiAttributionDecision.count({
        where: { organizationId, wasOverridden: true },
      }),
      db.aiAttributionDecision.count({
        where: {
          organizationId,
          OR: [{ requiredReview: true }, { predictedConfidence: { lt: 0.65 } }],
        },
      }),
      db.attributionModelVersion.findFirst({
        where: { organizationId, isActive: true },
        orderBy: { trainedAt: "desc" },
      }),
      db.attributionTrainingExample.count({
        where: { organizationId, deletedAt: null },
      }),
    ]);

  const topPredicted = await db.aiAttributionDecision.groupBy({
    by: ["predictedTaskType"],
    where: { organizationId, predictedTaskType: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { predictedTaskType: "desc" } },
    take: 1,
  });

  const topOverridden = await db.aiAttributionDecision.groupBy({
    by: ["finalTaskType"],
    where: { organizationId, wasOverridden: true },
    _count: { _all: true },
    orderBy: { _count: { finalTaskType: "desc" } },
    take: 1,
  });

  return {
    predictionCount: total,
    overrideRate: total === 0 ? 0 : overridden / total,
    lowConfidenceRate: total === 0 ? 0 : lowConfidence / total,
    activeModelVersion: activeModel?.version ?? null,
    lastTrainedAt: activeModel?.trainedAt ?? null,
    holdoutMacroF1: activeModel?.macroF1 ?? null,
    holdoutTop2Accuracy: activeModel?.top2Accuracy ?? null,
    trainingExampleCount: trainingCount,
    mostCommonPredictedTaskType: topPredicted[0]?.predictedTaskType ?? null,
    mostOverriddenTaskType: topOverridden[0]?.finalTaskType ?? null,
  };
}
