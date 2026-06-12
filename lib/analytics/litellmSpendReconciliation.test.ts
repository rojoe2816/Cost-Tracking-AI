import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockQueryRawUnsafe = vi.hoisted(() => vi.fn());
const mockPrismaClient = vi.hoisted(() =>
  vi.fn(function PrismaClientMock() {
    return {
      $queryRawUnsafe: mockQueryRawUnsafe,
    };
  }),
);

vi.mock("@prisma/client", () => ({
  PrismaClient: mockPrismaClient,
}));

const originalAnalyticsUrl = process.env.LITELLM_ANALYTICS_DATABASE_URL;

describe("reconcileLiteLlmSpendByAppRequestId", () => {
  beforeEach(() => {
    vi.resetModules();
    mockQueryRawUnsafe.mockReset();
    mockPrismaClient.mockClear();
    delete (globalThis as { liteLlmAnalyticsDb?: unknown }).liteLlmAnalyticsDb;
  });

  afterEach(() => {
    if (originalAnalyticsUrl === undefined) {
      delete process.env.LITELLM_ANALYTICS_DATABASE_URL;
    } else {
      process.env.LITELLM_ANALYTICS_DATABASE_URL = originalAnalyticsUrl;
    }

    delete (globalThis as { liteLlmAnalyticsDb?: unknown }).liteLlmAnalyticsDb;
  });

  it("queries spend logs by app_request tag and maps normalized usage facts", async () => {
    process.env.LITELLM_ANALYTICS_DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/litellm";
    mockQueryRawUnsafe.mockResolvedValue([
      {
        requestId: "chatcmpl-123",
        spend: "0.0000132",
        model: "openai/gpt-4o-mini",
        provider: "openai",
        promptTokens: 52,
        completionTokens: 9,
        totalTokens: 61,
      },
    ]);

    const { reconcileLiteLlmSpendByAppRequestId } = await import(
      "./litellmSpendReconciliation"
    );

    const result = await reconcileLiteLlmSpendByAppRequestId("audit_123");

    expect(mockPrismaClient).toHaveBeenCalledWith(
      expect.objectContaining({
        datasourceUrl: "postgresql://postgres:postgres@localhost:5432/litellm",
      }),
    );

    const [sql, requestId, tag, appRequestId] = mockQueryRawUnsafe.mock.calls[0] as [
      string,
      string,
      string,
      string,
    ];

    expect(sql).toContain('FROM "LiteLLM_SpendLogs"');
    expect(sql).toContain("metadata->>'app_request_id'");
    expect(sql).not.toContain("messages");
    expect(sql).not.toContain("response");
    expect(requestId).toBe("");
    expect(tag).toBe("app_request:audit_123");
    expect(appRequestId).toBe("audit_123");
    expect(result).toEqual({
      externalLiteLlmRequestId: "chatcmpl-123",
      provider: "openai",
      model: "openai/gpt-4o-mini",
      usage: {
        inputTokens: 52,
        outputTokens: 9,
        totalTokens: 61,
      },
      costUsd: 0.0000132,
    });
  });

  it("passes through an external request id when one is already known", async () => {
    process.env.LITELLM_ANALYTICS_DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/litellm";
    mockQueryRawUnsafe.mockResolvedValue([
      {
        requestId: "chatcmpl-789",
        spend: 0.00001,
        model: "openai/gpt-4o-mini",
        provider: "openai",
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
    ]);

    const { reconcileLiteLlmSpendByAppRequestId } = await import(
      "./litellmSpendReconciliation"
    );

    await reconcileLiteLlmSpendByAppRequestId("audit_789", "chatcmpl-789");

    expect(mockQueryRawUnsafe).toHaveBeenCalled();
    expect(mockQueryRawUnsafe.mock.calls[0]?.[1]).toBe("chatcmpl-789");
  });

  it("returns null when no analytics database is configured", async () => {
    delete process.env.LITELLM_ANALYTICS_DATABASE_URL;

    const { reconcileLiteLlmSpendByAppRequestId } = await import(
      "./litellmSpendReconciliation"
    );

    await expect(
      reconcileLiteLlmSpendByAppRequestId("audit_456"),
    ).resolves.toBeNull();

    expect(mockPrismaClient).not.toHaveBeenCalled();
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });
});
