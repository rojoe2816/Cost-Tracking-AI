import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: {
    ATTRIBUTION_SERVICE_URL: "http://classifier.test",
    ATTRIBUTION_SERVICE_TOKEN: "test-token",
  },
}));

import { evaluateAttributionClassifier } from "./client";

describe("attribution evaluation client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns detailed live holdout metrics without exposing the token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          modelVersion: "model-1",
          holdoutSamples: 41,
          workflowAccuracy: 0.85,
          workflowMacroF1: 0.84,
          workflowTop2Accuracy: 0.95,
          taskTypeAccuracy: 0.92,
          taskTypeMacroF1: 0.91,
          taskTypeTop2Accuracy: 0.97,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(evaluateAttributionClassifier()).resolves.toMatchObject({
      modelVersion: "model-1",
      workflowMacroF1: 0.84,
      taskTypeMacroF1: 0.91,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://classifier.test/v1/evaluate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
        cache: "no-store",
      }),
    );
  });
});
