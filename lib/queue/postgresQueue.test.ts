import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  backgroundJob: {
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));

const mockDispatch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/queue/dispatch", () => ({
  dispatchBackgroundJobSafely: mockDispatch,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  claimNextPostgresJob,
  completePostgresJob,
  enqueuePostgresJob,
  failPostgresJob,
  processClaimedPostgresJob,
} from "./postgresQueue";
import { formatSmallUsd } from "@/lib/db/costs";
import { sanitizeSlackAiRequestPayloadForStorage } from "./types";

describe("sanitizeSlackAiRequestPayloadForStorage", () => {
  it("removes inline prompt text before persistence", () => {
    expect(
      sanitizeSlackAiRequestPayloadForStorage({
        slackTeamId: "T_TEST",
        slackChannelId: "C_TEST",
        slackUserId: "U_TEST",
        text: "secret prompt",
        messageTs: "123.456",
      }),
    ).toEqual({
      slackTeamId: "T_TEST",
      slackChannelId: "C_TEST",
      slackUserId: "U_TEST",
      messageTs: "123.456",
    });
  });
});

describe("enqueuePostgresJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.backgroundJob.create.mockResolvedValue({ id: "job_1" });
  });

  it("persists metadata-only payloads", async () => {
    await enqueuePostgresJob("slack.ai_request", {
      slackTeamId: "T_TEST",
      slackChannelId: "C_TEST",
      slackUserId: "U_TEST",
      text: "secret prompt",
      messageTs: "123.456",
    });

    expect(mockDb.backgroundJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "slack.ai_request",
        payloadJson: {
          slackTeamId: "T_TEST",
          slackChannelId: "C_TEST",
          slackUserId: "U_TEST",
          messageTs: "123.456",
        },
      }),
    });
  });

  it("ignores duplicate idempotency keys", async () => {
    mockDb.backgroundJob.create.mockRejectedValue({ code: "P2002" });

    await expect(
      enqueuePostgresJob(
        "slack.ai_request",
        {
          slackTeamId: "T_TEST",
          slackChannelId: "C_TEST",
          slackUserId: "U_TEST",
          messageTs: "123.456",
        },
        { idempotencyKey: "slack:event:T_TEST:C_TEST:123.456" },
      ),
    ).resolves.toBeUndefined();
  });
});

describe("postgres worker lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims the next queued job with row locking", async () => {
    const claimedJob = {
      id: "job_1",
      type: "slack.ai_request",
      payloadJson: {
        slackTeamId: "T_TEST",
        slackChannelId: "C_TEST",
        slackUserId: "U_TEST",
        messageTs: "123.456",
      },
      attempts: 1,
      maxAttempts: 3,
    };

    mockDb.$transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: vi.fn().mockResolvedValue([{ id: "job_1" }]),
        backgroundJob: {
          update: vi.fn().mockResolvedValue(claimedJob),
        },
      }),
    );

    const job = await claimNextPostgresJob("worker-1");

    expect(job).toEqual(claimedJob);
  });

  it("marks claimed jobs completed after successful dispatch", async () => {
    mockDispatch.mockResolvedValue(undefined);
    mockDb.backgroundJob.update.mockResolvedValue({ id: "job_1" });

    await processClaimedPostgresJob({
      id: "job_1",
      type: "slack.ai_request",
      payloadJson: {
        slackTeamId: "T_TEST",
        slackChannelId: "C_TEST",
        slackUserId: "U_TEST",
        messageTs: "123.456",
      },
      attempts: 1,
      maxAttempts: 3,
    } as never);

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDb.backgroundJob.update).toHaveBeenCalledWith({
      where: { id: "job_1" },
      data: expect.objectContaining({ status: "COMPLETED" }),
    });
  });

  it("retries failed jobs until max attempts", async () => {
    mockDispatch.mockRejectedValue(new Error("temporary failure"));
    mockDb.backgroundJob.update.mockResolvedValue({ id: "job_1" });

    await processClaimedPostgresJob({
      id: "job_1",
      type: "slack.ai_request",
      payloadJson: {},
      attempts: 1,
      maxAttempts: 3,
    } as never);

    expect(mockDb.backgroundJob.update).toHaveBeenCalledWith({
      where: { id: "job_1" },
      data: expect.objectContaining({
        status: "QUEUED",
        lastError: "temporary failure",
      }),
    });
  });

  it("marks jobs failed after max attempts", async () => {
    await failPostgresJob(
      {
        id: "job_1",
        type: "slack.ai_request",
        attempts: 3,
        maxAttempts: 3,
      } as never,
      new Error("permanent failure"),
    );

    expect(mockDb.backgroundJob.update).toHaveBeenCalledWith({
      where: { id: "job_1" },
      data: expect.objectContaining({
        status: "FAILED",
        lastError: "permanent failure",
      }),
    });
  });

  it("completes jobs explicitly", async () => {
    await completePostgresJob("job_1");

    expect(mockDb.backgroundJob.update).toHaveBeenCalledWith({
      where: { id: "job_1" },
      data: expect.objectContaining({
        status: "COMPLETED",
        lastError: null,
      }),
    });
  });
});

describe("formatSmallUsd", () => {
  it("shows tiny spend with extra precision", () => {
    expect(formatSmallUsd(0.000019)).toBe("$0.000019");
  });
});
