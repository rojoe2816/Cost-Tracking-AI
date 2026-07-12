import { beforeEach, describe, expect, it, vi } from "vitest";

import { SlateApiError, SlateClient } from "./index";

const apiKey = "slate_app_sk_server-secret";

describe("SlateClient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds server authentication and calls the versioned context route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        requestId: "req-1",
        organization: { name: "Org" },
        sourceApp: { name: "App", type: "internal_ai" },
        employees: [],
        clients: [],
        projects: [],
        workflows: [],
        models: [],
      }),
    );
    const client = new SlateClient({
      apiKey,
      baseUrl: "http://localhost:3000/",
      fetch: fetchMock,
    });

    await client.getContext();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/context",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: `Bearer ${apiKey}` }),
      }),
    );
  });

  it("retries a transient run only because sourceAppRequestId is present", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { requestId: "trace-1", error: { code: "UPSTREAM", message: "retry" } },
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          traceId: "trace-1",
          requestId: "audit-1",
          response: "ok",
          usage: {
            model: "gpt-4o-mini",
            provider: "openai",
            inputTokens: 1,
            outputTokens: 1,
            totalTokens: 2,
            costMicros: 1,
            latencyMs: 10,
          },
          attribution: {
            employeeExternalId: "emp-1",
            clientExternalId: null,
            projectExternalId: null,
            workflowExternalId: null,
            taskType: null,
            sourceAppRequestId: "source-1",
          },
        }),
      );
    const client = new SlateClient({
      apiKey,
      baseUrl: "http://localhost:3000",
      maxRetries: 1,
      fetch: fetchMock,
    });

    const result = await client.run({
      employeeExternalId: "emp-1",
      sourceAppRequestId: "source-1",
      input: "hello",
    });

    expect(result.response).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws a typed non-retryable authentication error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          requestId: "trace-401",
          error: { code: "INVALID_API_KEY", message: "Invalid key." },
        },
        { status: 401 },
      ),
    );
    const client = new SlateClient({
      apiKey,
      baseUrl: "http://localhost:3000",
      maxRetries: 2,
      fetch: fetchMock,
    });

    await expect(client.getContext()).rejects.toMatchObject<SlateApiError>({
      code: "INVALID_API_KEY",
      status: 401,
      requestId: "trace-401",
      retryable: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
