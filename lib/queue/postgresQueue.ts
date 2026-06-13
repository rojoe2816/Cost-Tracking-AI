import "server-only";

import type { BackgroundJob } from "@prisma/client";

import { db } from "@/lib/db";
import { dispatchBackgroundJobSafely } from "@/lib/queue/dispatch";
import { logger } from "@/lib/logger";
import type {
  EnqueueJobOptions,
  JobName,
  JobPayloadByName,
  SlackAiRequestJobPayload,
} from "@/lib/queue/types";
import {
  safeSlackAiRequestJobMetadata,
  safeSlackInteractivityJobMetadata,
  sanitizeSlackAiRequestPayloadForStorage,
} from "@/lib/queue/types";

const MAX_ERROR_LENGTH = 1000;

function sanitizePayloadForStorage<TName extends JobName>(
  name: TName,
  payload: JobPayloadByName[TName],
): JobPayloadByName[TName] {
  if (name === "slack.ai_request") {
    return sanitizeSlackAiRequestPayloadForStorage(
      payload as SlackAiRequestJobPayload,
    ) as JobPayloadByName[TName];
  }

  return payload;
}

function safeJobMetadata<TName extends JobName>(
  name: TName,
  payload: JobPayloadByName[TName],
) {
  if (name === "slack.ai_request") {
    return safeSlackAiRequestJobMetadata(payload as SlackAiRequestJobPayload);
  }

  return safeSlackInteractivityJobMetadata(
    payload as JobPayloadByName["slack.interactivity"],
  );
}

export async function enqueuePostgresJob<TName extends JobName>(
  name: TName,
  payload: JobPayloadByName[TName],
  options: EnqueueJobOptions = {},
): Promise<void> {
  const storedPayload = sanitizePayloadForStorage(name, payload);

  logger.info(
    {
      jobName: name,
      adapter: "postgres",
      ...safeJobMetadata(name, payload),
      idempotencyKey: options.idempotencyKey,
    },
    "Enqueuing durable background job",
  );

  try {
    await db.backgroundJob.create({
      data: {
        type: name,
        payloadJson: storedPayload,
        ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
        ...(options.runAfter ? { runAfter: options.runAfter } : {}),
        ...(options.maxAttempts ? { maxAttempts: options.maxAttempts } : {}),
      },
    });
  } catch (error) {
    const prismaError = error as { code?: string };

    if (options.idempotencyKey && prismaError.code === "P2002") {
      logger.info(
        {
          jobName: name,
          idempotencyKey: options.idempotencyKey,
          duplicate: true,
        },
        "Skipped duplicate durable background job",
      );
      return;
    }

    throw error;
  }
}

function computeRetryDelaySeconds(attempts: number): number {
  return Math.min(300, 2 ** Math.max(attempts, 1));
}

function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, MAX_ERROR_LENGTH);
  }

  return "Background job failed".slice(0, MAX_ERROR_LENGTH);
}

export async function claimNextPostgresJob(
  workerId: string,
): Promise<BackgroundJob | null> {
  return db.$transaction(async (tx) => {
    const candidates = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "BackgroundJob"
      WHERE status = 'QUEUED'
        AND "runAfter" <= NOW()
      ORDER BY "runAfter" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;

    const candidate = candidates[0];

    if (!candidate) {
      return null;
    }

    return tx.backgroundJob.update({
      where: { id: candidate.id },
      data: {
        status: "PROCESSING",
        lockedAt: new Date(),
        lockedBy: workerId,
        attempts: { increment: 1 },
      },
    });
  });
}

export async function completePostgresJob(jobId: string): Promise<void> {
  await db.backgroundJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  });
}

export async function failPostgresJob(
  job: BackgroundJob,
  error: unknown,
): Promise<void> {
  const lastError = sanitizeErrorMessage(error);
  const shouldRetry = job.attempts < job.maxAttempts;

  if (shouldRetry) {
    const delaySeconds = computeRetryDelaySeconds(job.attempts);

    await db.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "QUEUED",
        lockedAt: null,
        lockedBy: null,
        lastError,
        runAfter: new Date(Date.now() + delaySeconds * 1000),
      },
    });

    logger.warn(
      {
        jobId: job.id,
        jobType: job.type,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        retryInSeconds: delaySeconds,
      },
      "Scheduled durable background job retry",
    );
    return;
  }

  await db.backgroundJob.update({
    where: { id: job.id },
    data: {
      status: "FAILED",
      lockedAt: null,
      lockedBy: null,
      lastError,
    },
  });

  logger.error(
    {
      jobId: job.id,
      jobType: job.type,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    },
    "Durable background job permanently failed",
  );
}

export async function processClaimedPostgresJob(job: BackgroundJob): Promise<void> {
  const jobName = job.type as JobName;

  try {
    await dispatchBackgroundJobSafely(
      jobName,
      job.payloadJson as JobPayloadByName[typeof jobName],
      job.id,
    );
    await completePostgresJob(job.id);
  } catch (error) {
    await failPostgresJob(job, error);
  }
}

export async function getRecentBackgroundJobs(limit = 20) {
  return db.backgroundJob.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      status: true,
      attempts: true,
      maxAttempts: true,
      runAfter: true,
      lockedAt: true,
      lastError: true,
      idempotencyKey: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
