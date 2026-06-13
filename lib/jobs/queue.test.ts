import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHandleSlackAiRequestJob = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);

vi.mock("@/lib/jobs/handlers/slackAiRequest", () => ({
  handleSlackAiRequestJob: mockHandleSlackAiRequestJob,
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
  enqueueInMemoryJob,
  resetInMemoryQueueForTests,
} from "@/lib/queue/inMemoryQueue";

const PAYLOAD = {
  organizationId: "org_1",
  slackTeamId: "T_TEST",
  slackChannelId: "C_TEST",
  slackUserId: "U_TEST",
  text: "hello",
};

describe("in-memory queue adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetInMemoryQueueForTests();
  });

  it("delegates slack.ai_request jobs to handleSlackAiRequestJob", async () => {
    await enqueueInMemoryJob("slack.ai_request", PAYLOAD);
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockHandleSlackAiRequestJob).toHaveBeenCalledTimes(1);
    expect(mockHandleSlackAiRequestJob).toHaveBeenCalledWith(PAYLOAD);
  });

  it("skips duplicate jobs with the same idempotency key", async () => {
    await enqueueInMemoryJob("slack.ai_request", PAYLOAD, {
      idempotencyKey: "slack:event:T_TEST:C_TEST:123.456",
    });
    await enqueueInMemoryJob("slack.ai_request", PAYLOAD, {
      idempotencyKey: "slack:event:T_TEST:C_TEST:123.456",
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockHandleSlackAiRequestJob).toHaveBeenCalledTimes(1);
  });
});
