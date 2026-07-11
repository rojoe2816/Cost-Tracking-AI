import "server-only";

import { createHash } from "node:crypto";

import { loadApprovedTrainingExamples } from "@/lib/attribution/training";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { AttributionRetrainJobPayload } from "@/lib/queue/types";

const MIN_MACRO_F1 = 0.8;
const MAX_REGRESSION = 0.03;

export async function handleAttributionRetrainJob(
  payload: AttributionRetrainJobPayload,
): Promise<void> {
  const baseUrl = env.ATTRIBUTION_SERVICE_URL?.replace(/\/$/, "");
  const token = env.ATTRIBUTION_SERVICE_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("Attribution service is not configured for retraining.");
  }

  const examples = await loadApprovedTrainingExamples(payload.organizationId);
  if (examples.length === 0) {
    logger.info(
      { organizationId: payload.organizationId },
      "No approved attribution training examples; skipping retrain",
    );
    return;
  }

  const current = await db.attributionModelVersion.findFirst({
    where: { organizationId: payload.organizationId, isActive: true },
    orderBy: { trainedAt: "desc" },
  });

  const trainResponse = await fetch(`${baseUrl}/v1/train`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organizationId: payload.organizationId,
      examples: examples.map((example) => ({
        text: example.text,
        workflowExternalId: example.workflowExternalId,
        taskType: example.taskType,
      })),
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!trainResponse.ok) {
    throw new Error("Attribution retrain request failed.");
  }

  const trained = (await trainResponse.json()) as {
    modelVersion?: string;
    sampleCount?: number;
  };

  const evaluateResponse = await fetch(`${baseUrl}/v1/evaluate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organizationId: payload.organizationId,
      modelVersion: trained.modelVersion,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!evaluateResponse.ok) {
    throw new Error("Attribution evaluate request failed.");
  }

  const evaluation = (await evaluateResponse.json()) as {
    macroF1?: number;
    top2Accuracy?: number;
    accuracy?: number;
  };

  const macroF1 = evaluation.macroF1 ?? 0;
  const top2Accuracy = evaluation.top2Accuracy ?? 0;
  const version = trained.modelVersion ?? `retrain-${Date.now()}`;
  const checksum = createHash("sha256")
    .update(JSON.stringify({ version, macroF1, top2Accuracy, n: examples.length }))
    .digest("hex");

  const shouldPromote =
    macroF1 >= MIN_MACRO_F1 &&
    (current?.macroF1 == null || macroF1 + MAX_REGRESSION >= current.macroF1);

  if (!shouldPromote) {
    await db.attributionModelVersion.create({
      data: {
        organizationId: payload.organizationId,
        version,
        checksum,
        macroF1,
        top2Accuracy,
        isActive: false,
        evaluationJson: evaluation,
      },
    });
    logger.info(
      {
        organizationId: payload.organizationId,
        version,
        macroF1,
        previousMacroF1: current?.macroF1 ?? null,
      },
      "Rejected attribution model candidate",
    );
    return;
  }

  await db.$transaction([
    db.attributionModelVersion.updateMany({
      where: { organizationId: payload.organizationId, isActive: true },
      data: { isActive: false },
    }),
    db.attributionModelVersion.create({
      data: {
        organizationId: payload.organizationId,
        version,
        checksum,
        macroF1,
        top2Accuracy,
        isActive: true,
        evaluationJson: evaluation,
      },
    }),
  ]);

  logger.info(
    {
      organizationId: payload.organizationId,
      version,
      macroF1,
      top2Accuracy,
      sampleCount: examples.length,
    },
    "Promoted attribution model version",
  );
}
