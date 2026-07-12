import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLoadExamples = vi.hoisted(() => vi.fn());
const mockDb = vi.hoisted(() => ({
  attributionModelVersion: {
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/attribution/training", () => ({
  loadApprovedTrainingExamples: mockLoadExamples,
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/env", () => ({
  env: {
    ATTRIBUTION_SERVICE_URL: "http://classifier.test",
    ATTRIBUTION_SERVICE_TOKEN: "test-token",
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn() },
}));

import { handleAttributionRetrainJob } from "./attributionRetrain";

const example = {
  text: "Synthetic consented example",
  workflowExternalId: "client-update",
  taskType: "client_update",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("attribution retraining handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadExamples.mockResolvedValue([example]);
    mockDb.attributionModelVersion.findFirst.mockResolvedValue(null);
    mockDb.attributionModelVersion.create.mockResolvedValue({});
    mockDb.attributionModelVersion.updateMany.mockResolvedValue({});
    mockDb.$transaction.mockResolvedValue([]);
  });

  it("passes consented examples and promotes a qualifying candidate", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ modelVersion: "candidate-1", trainingSamples: 210 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          workflowAccuracy: 0.9,
          workflowMacroF1: 0.86,
          workflowTop2Accuracy: 0.95,
          taskTypeAccuracy: 0.92,
          taskTypeMacroF1: 0.9,
          taskTypeTop2Accuracy: 0.97,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ status: "ok", modelVersion: "candidate-1" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await handleAttributionRetrainJob({
      organizationId: "org_1",
    });

    const trainBody = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit).body),
    );
    expect(trainBody.examples).toEqual([example]);
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "http://classifier.test/v1/promote",
    );
    expect(mockDb.$transaction).toHaveBeenCalledOnce();
  });

  it("records but does not promote a candidate below the quality floor", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ modelVersion: "candidate-bad", trainingSamples: 210 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          workflowMacroF1: 0.79,
          workflowTop2Accuracy: 0.95,
          taskTypeMacroF1: 0.9,
          taskTypeTop2Accuracy: 0.97,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await handleAttributionRetrainJob({
      organizationId: "org_1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mockDb.attributionModelVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: "candidate-bad",
          macroF1: 0.79,
          isActive: false,
        }),
      }),
    );
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });
});
