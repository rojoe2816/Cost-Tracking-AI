import "server-only";

import { encryptSecret, decryptSecret } from "@/lib/security/encryption";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { enqueueJob } from "@/lib/queue";

export async function createConsentedTrainingExample(input: {
  organizationId: string;
  text: string;
  finalWorkflowTypeId: string;
  finalTaskType: string;
}): Promise<{ created: boolean; reason?: string }> {
  const privacy = await db.organizationPrivacySettings.findUnique({
    where: { organizationId: input.organizationId },
    select: { allowAttributionTrainingTextStorage: true },
  });

  if (!privacy?.allowAttributionTrainingTextStorage) {
    return { created: false, reason: "TRAINING_TEXT_DISABLED" };
  }

  await db.attributionTrainingExample.create({
    data: {
      organizationId: input.organizationId,
      encryptedText: encryptSecret(input.text),
      finalWorkflowTypeId: input.finalWorkflowTypeId,
      finalTaskType: input.finalTaskType,
      approved: true,
      consentCapturedAt: new Date(),
      source: "user_consent",
    },
  });

  const pending = await db.attributionTrainingExample.count({
    where: {
      organizationId: input.organizationId,
      approved: true,
      deletedAt: null,
    },
  });

  const minExamples = env.ATTRIBUTION_RETRAIN_MIN_EXAMPLES ?? 5;
  if (pending >= minExamples) {
    await enqueueJob(
      "attribution.retrain",
      { organizationId: input.organizationId },
      {
        idempotencyKey: `attribution-retrain-${input.organizationId}-${Math.floor(pending / minExamples)}`,
      },
    );
  }

  return { created: true };
}

export async function listTrainingExamplesForAdmin(organizationId: string) {
  return db.attributionTrainingExample.findMany({
    where: { organizationId, deletedAt: null },
    select: {
      id: true,
      finalTaskType: true,
      approved: true,
      source: true,
      consentCapturedAt: true,
      createdAt: true,
      finalWorkflowType: { select: { name: true, externalId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function softDeleteTrainingExample(input: {
  organizationId: string;
  exampleId: string;
}): Promise<boolean> {
  const result = await db.attributionTrainingExample.updateMany({
    where: {
      id: input.exampleId,
      organizationId: input.organizationId,
      deletedAt: null,
    },
    data: { deletedAt: new Date(), approved: false },
  });
  return result.count > 0;
}

export async function loadApprovedTrainingExamples(organizationId: string) {
  const rows = await db.attributionTrainingExample.findMany({
    where: {
      organizationId,
      approved: true,
      deletedAt: null,
    },
    select: {
      encryptedText: true,
      finalTaskType: true,
      finalWorkflowType: { select: { externalId: true, name: true } },
    },
    take: 500,
  });

  return rows.map((row) => ({
    text: decryptSecret(row.encryptedText),
    taskType: row.finalTaskType,
    workflowExternalId: row.finalWorkflowType.externalId ?? row.finalWorkflowType.name,
  }));
}
