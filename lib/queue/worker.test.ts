import { describe, expect, it, vi } from "vitest";

const mockClaim = vi.hoisted(() => vi.fn());
const mockProcess = vi.hoisted(() => vi.fn());
const mockHeartbeat = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/queue/postgresQueue", () => ({
  claimNextPostgresJob: mockClaim,
  processClaimedPostgresJob: mockProcess,
}));
vi.mock("@/lib/public-api/health", () => ({
  recordWorkerHeartbeat: mockHeartbeat,
}));
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

import { runWorkerLoop } from "./worker";

describe("durable worker loop", () => {
  it("retries after a transient database poll failure", async () => {
    const controller = new AbortController();
    mockClaim
      .mockRejectedValueOnce(
        Object.assign(new Error("database unavailable"), { code: "P1017" }),
      )
      .mockImplementationOnce(async () => {
        controller.abort();
        return null;
      });

    await runWorkerLoop({
      workerId: "worker-test",
      pollIntervalMs: 1,
      maxJobsPerTick: 1,
      signal: controller.signal,
    });

    expect(mockClaim).toHaveBeenCalledTimes(2);
    expect(mockHeartbeat).toHaveBeenCalledOnce();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        workerId: "worker-test",
        errorName: "Error",
        errorCode: "P1017",
      }),
      "Background worker poll failed; retrying",
    );
  });
});
