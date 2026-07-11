import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/env", () => ({
  env: {
    LITELLM_PROXY_URL: "http://127.0.0.1:4000",
  },
}));

import {
  getModelGatewayHealthStatus,
  getPublicHealthSnapshot,
  recordWorkerHeartbeat,
} from "./health";

describe("public health probes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok", { status: 200 })),
    );
  });

  it("reports modelGateway healthy when LiteLLM liveliness succeeds", async () => {
    await expect(getModelGatewayHealthStatus()).resolves.toBe("healthy");
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/health/liveliness",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("reports degraded when the model gateway probe fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const snapshot = await getPublicHealthSnapshot();
    expect(snapshot.modelGateway).toBe("unhealthy");
    expect(snapshot.ok).toBe(false);
    expect(snapshot.status).toBe("degraded");
  });

  it("marks the worker healthy after a heartbeat is recorded", async () => {
    await recordWorkerHeartbeat("worker-test");
    const snapshot = await getPublicHealthSnapshot();
    expect(snapshot.worker).toBe("healthy");
    expect(snapshot.ok).toBe(true);
    expect(snapshot.status).toBe("ok");
  });
});
