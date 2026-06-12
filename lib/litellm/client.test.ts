import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));

import {
  buildLiteLlmTags,
  LiteLlmClientError,
  sendLiteLlmChatCompletion,
} from "./client";

const METADATA = {
  organization_id: "org_1",
  user_id: "user_1",
  client_id: "client_1",
  project_id: "project_1",
  workflow_type_id: "workflow_1",
  source: "slack" as const,
  app_request_id: "req_123",
};

const MESSAGES = [
  { role: "user" as const, content: "Secret prompt text should not be logged" },
];

function mockFetchResponse(
  body: unknown,
  options: {
    ok?: boolean;
    status?: number;
    headers?: Record<string, string>;
  } = {},
) {
  const { ok = true, status = 200, headers = {} } = options;

  return {
    ok,
    status,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    json: vi.fn().mockResolvedValue(body),
  };
}

describe("buildLiteLlmTags", () => {
  it("builds safe attribution tags without prompt text", () => {
    expect(buildLiteLlmTags(METADATA)).toEqual([
      "org:org_1",
      "source:slack",
      "app_request:req_123",
      "client:client_1",
      "project:project_1",
      "workflow:workflow_1",
    ]);
  });

  it("omits optional tags when ids are absent", () => {
    expect(
      buildLiteLlmTags({
        organization_id: "org_1",
        source: "web",
        app_request_id: "req_456",
      }),
    ).toEqual(["org:org_1", "source:web", "app_request:req_456"]);
  });
});

describe("sendLiteLlmChatCompletion", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("calls the LiteLLM proxy chat completions endpoint with bearer auth", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        model: "gpt-4o-mini",
        choices: [{ message: { role: "assistant", content: "Hello" } }],
      }),
    );

    await sendLiteLlmChatCompletion({
      model: "gpt-4o-mini",
      messages: MESSAGES,
      metadata: METADATA,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("http://localhost:4000/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer sk-test-litellm-master-key",
      "Content-Type": "application/json",
    });
  });

  it("sends metadata and safe tags in the request body", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        model: "gpt-4o-mini",
        choices: [{ message: { role: "assistant", content: "Done" } }],
      }),
    );

    await sendLiteLlmChatCompletion({
      model: "gpt-4o-mini",
      messages: MESSAGES,
      metadata: METADATA,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));

    expect(body.metadata).toEqual(METADATA);
    expect(body.tags).toEqual(buildLiteLlmTags(METADATA));
    expect(body.messages).toEqual(MESSAGES);
  });

  it("parses assistant content, usage, provider, request id, and cost", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        {
          model: "gpt-4o-mini",
          choices: [{ message: { role: "assistant", content: "Assistant reply" } }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
          _hidden_params: {
            custom_llm_provider: "openai",
            response_cost: 0.00042,
          },
        },
        {
          headers: {
            "x-litellm-request-id": "litellm-req-1",
          },
        },
      ),
    );

    await expect(
      sendLiteLlmChatCompletion({
        model: "gpt-4o-mini",
        messages: MESSAGES,
        metadata: METADATA,
      }),
    ).resolves.toEqual({
      content: "Assistant reply",
      provider: "openai",
      model: "gpt-4o-mini",
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      },
      costUsd: 0.00042,
      externalLiteLlmRequestId: "litellm-req-1",
    });
  });

  it("falls back to response body ids when LiteLLM headers are absent", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        id: "chatcmpl-123",
        model: "gpt-4o-mini",
        choices: [{ message: { role: "assistant", content: "Body id works" } }],
      }),
    );

    const result = await sendLiteLlmChatCompletion({
      model: "gpt-4o-mini",
      messages: MESSAGES,
      metadata: METADATA,
    });

    expect(result.externalLiteLlmRequestId).toBe("chatcmpl-123");
  });

  it("parses response cost from headers when LiteLLM omits body cost fields", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        {
          model: "gpt-4o-mini",
          choices: [{ message: { role: "assistant", content: "Header cost" } }],
        },
        {
          headers: {
            "x-response-cost": "0.0000132",
          },
        },
      ),
    );

    const result = await sendLiteLlmChatCompletion({
      model: "gpt-4o-mini",
      messages: MESSAGES,
      metadata: METADATA,
    });

    expect(result.costUsd).toBe(0.0000132);
  });

  it("leaves costUsd undefined when LiteLLM does not return cost", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        model: "gpt-4o-mini",
        choices: [{ message: { role: "assistant", content: "No cost" } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );

    const result = await sendLiteLlmChatCompletion({
      model: "gpt-4o-mini",
      messages: MESSAGES,
      metadata: METADATA,
    });

    expect(result.costUsd).toBeUndefined();
  });

  it("throws LiteLlmClientError for non-200 responses", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        {
          error: {
            message: "Authentication Error",
            code: "401",
          },
        },
        { ok: false, status: 401 },
      ),
    );

    await expect(
      sendLiteLlmChatCompletion({
        model: "gpt-4o-mini",
        messages: MESSAGES,
        metadata: METADATA,
      }),
    ).rejects.toMatchObject({
      name: "LiteLlmClientError",
      status: 401,
      message: "Authentication Error",
      details: {
        model: "gpt-4o-mini",
        appRequestId: "req_123",
        providerErrorCode: "401",
      },
    });
  });

  it("does not log prompt or response text", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        model: "gpt-4o-mini",
        choices: [
          {
            message: {
              role: "assistant",
              content: "Sensitive assistant response",
            },
          },
        ],
      }),
    );

    await sendLiteLlmChatCompletion({
      model: "gpt-4o-mini",
      messages: MESSAGES,
      metadata: METADATA,
    });

    const loggedPayload = JSON.stringify(mockLogger.info.mock.calls);
    expect(loggedPayload).not.toContain("Secret prompt text");
    expect(loggedPayload).not.toContain("Sensitive assistant response");
    expect(loggedPayload).not.toContain("sk-test-litellm-master-key");
  });

  it("throws LiteLlmClientError on network failure", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      sendLiteLlmChatCompletion({
        model: "gpt-4o-mini",
        messages: MESSAGES,
        metadata: METADATA,
      }),
    ).rejects.toMatchObject({
      name: "LiteLlmClientError",
      status: 0,
      message: "LiteLLM proxy request failed",
      details: {
        model: "gpt-4o-mini",
        appRequestId: "req_123",
      },
    });
  });

  it("throws LiteLlmClientError on timeout", async () => {
    vi.useFakeTimers();

    fetchMock.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
          });
        }),
    );

    const promise = sendLiteLlmChatCompletion({
      model: "gpt-4o-mini",
      messages: MESSAGES,
      metadata: METADATA,
    });

    const expectation = expect(promise).rejects.toMatchObject({
      name: "LiteLlmClientError",
      status: 0,
      message: "LiteLLM proxy request timed out",
    });

    await vi.advanceTimersByTimeAsync(30_000);
    await expectation;
  });

  it("falls back to the configured default model when input model is empty", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        model: "gpt-4o-mini",
        choices: [{ message: { role: "assistant", content: "ok" } }],
      }),
    );

    await sendLiteLlmChatCompletion({
      model: "",
      messages: MESSAGES,
      metadata: METADATA,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("gpt-4o-mini");
  });
});

describe("LiteLlmClientError", () => {
  it("is an Error subclass with structured details", () => {
    const error = new LiteLlmClientError("failed", 500, {
      model: "gpt-4o-mini",
      appRequestId: "req_1",
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("LiteLlmClientError");
    expect(error.status).toBe(500);
    expect(error.details?.appRequestId).toBe("req_1");
  });
});
