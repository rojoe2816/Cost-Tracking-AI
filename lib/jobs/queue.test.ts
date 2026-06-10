import { describe, expect, it, vi } from "vitest";

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

import { enqueueJob } from "./queue";

const PAYLOAD = {
  organizationId: "org_1",
  slackTeamId: "T_TEST",
  slackChannelId: "C_TEST",
  slackUserId: "U_TEST",
  text: "hello",
};

describe("enqueueJob", () => {
  it("delegates slack.ai_request jobs to handleSlackAiRequestJob", async () => {
    await enqueueJob("slack.ai_request", PAYLOAD);
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockHandleSlackAiRequestJob).toHaveBeenCalledTimes(1);
    expect(mockHandleSlackAiRequestJob).toHaveBeenCalledWith(PAYLOAD);
  });
});
