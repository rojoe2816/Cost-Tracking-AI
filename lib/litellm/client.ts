import "server-only";

import { env } from "@/lib/env";
import {
  classifySecret,
  combineStatuses,
  type IntegrationStatus,
} from "@/lib/integration-status";
import { logger } from "@/lib/logger";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_ERROR_MESSAGE_LENGTH = 1000;

export class LiteLlmClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: {
      model?: string;
      appRequestId?: string;
      providerErrorCode?: string;
    },
  ) {
    super(message);
    this.name = "LiteLlmClientError";
  }
}

export interface LiteLLMRuntimeConfig {
  status: IntegrationStatus;
  baseUrl: string | undefined;
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LiteLlmMetadata = {
  organization_id: string;
  user_id?: string;
  client_id?: string;
  project_id?: string;
  workflow_type_id?: string;
  source: "slack" | "web";
  app_request_id: string;
};

type LiteLlmClientConfig = {
  proxyUrl: string;
  masterKey: string;
  defaultModel: string;
  timeoutMs: number;
};

export type LiteLlmUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type LiteLlmCompletionResult = {
  content: string;
  provider?: string;
  model: string;
  usage?: LiteLlmUsage;
  costUsd?: number;
  externalLiteLlmRequestId?: string;
};

/**
 * Lightweight config inspection only — no network health checks here.
 * "placeholder" means the .env.example dev values are still in use.
 */
export function getLiteLLMRuntimeConfig(): LiteLLMRuntimeConfig {
  const status = combineStatuses(
    env.LITELLM_PROXY_URL ? "configured" : "missing",
    classifySecret(env.LITELLM_MASTER_KEY),
  );

  return {
    status,
    baseUrl: env.LITELLM_PROXY_URL,
  };
}

/**
 * Throws when LiteLLM credentials are absent. Call this from routes/jobs
 * that actually need the proxy, not at module load or app boot.
 * Placeholder values are allowed: they work against a local proxy.
 */
export function assertLiteLLMConfigured(): {
  baseUrl: string;
  masterKey: string;
} {
  if (!env.LITELLM_PROXY_URL || !env.LITELLM_MASTER_KEY) {
    throw new Error(
      "LiteLLM is not configured. Set LITELLM_PROXY_URL and LITELLM_MASTER_KEY in .env.",
    );
  }

  return {
    baseUrl: env.LITELLM_PROXY_URL,
    masterKey: env.LITELLM_MASTER_KEY,
  };
}

export function createLiteLLMHeaders() {
  const { masterKey } = assertLiteLLMConfigured();

  return {
    Authorization: `Bearer ${masterKey}`,
    "Content-Type": "application/json",
  };
}

function getLiteLlmClientConfig(): LiteLlmClientConfig {
  const { baseUrl, masterKey } = assertLiteLLMConfigured();

  return {
    proxyUrl: baseUrl,
    masterKey,
    defaultModel: env.LITELLM_DEFAULT_MODEL?.trim() || DEFAULT_MODEL,
    timeoutMs: env.LITELLM_REQUEST_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
  };
}

export function buildLiteLlmTags(metadata: LiteLlmMetadata): string[] {
  return [
    `org:${metadata.organization_id}`,
    `source:${metadata.source}`,
    `app_request:${metadata.app_request_id}`,
    metadata.client_id ? `client:${metadata.client_id}` : undefined,
    metadata.project_id ? `project:${metadata.project_id}` : undefined,
    metadata.workflow_type_id
      ? `workflow:${metadata.workflow_type_id}`
      : undefined,
  ].filter((tag): tag is string => Boolean(tag));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    const converted = Number(trimmed);
    return Number.isFinite(converted) ? converted : undefined;
  }

  return undefined;
}

function truncateMessage(value: string, maxLength = MAX_ERROR_MESSAGE_LENGTH) {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 1)}…`;
}

async function parseJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractAssistantContent(body: unknown): string {
  if (!isRecord(body)) {
    return "";
  }

  const choices = body.choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }

  const firstChoice = choices[0];

  if (!isRecord(firstChoice)) {
    return "";
  }

  const message = firstChoice.message;

  if (!isRecord(message) || typeof message.content !== "string") {
    return "";
  }

  return message.content;
}

function extractUsage(body: unknown): LiteLlmUsage | undefined {
  if (!isRecord(body) || !isRecord(body.usage)) {
    return undefined;
  }

  const usage = body.usage;

  return {
    ...(typeof usage.prompt_tokens === "number"
      ? { inputTokens: usage.prompt_tokens }
      : {}),
    ...(typeof usage.completion_tokens === "number"
      ? { outputTokens: usage.completion_tokens }
      : {}),
    ...(typeof usage.total_tokens === "number"
      ? { totalTokens: usage.total_tokens }
      : {}),
  };
}

function extractHeaderValue(
  headers: Headers,
  names: readonly string[],
): string | undefined {
  for (const name of names) {
    const value = headers.get(name);

    if (isNonEmptyString(value)) {
      return value.trim();
    }
  }

  return undefined;
}

function extractRequestId(body: unknown, headers: Headers): string | undefined {
  const candidates: unknown[] = [];

  if (isRecord(body)) {
    candidates.push(body.request_id, body.requestId, body.id);

    if (isRecord(body._hidden_params)) {
      candidates.push(
        body._hidden_params.request_id,
        body._hidden_params.requestId,
        body._hidden_params.litellm_request_id,
        body._hidden_params.litellmRequestId,
        body._hidden_params.id,
      );
    }
  }

  for (const candidate of candidates) {
    if (isNonEmptyString(candidate)) {
      return candidate.trim();
    }
  }

  return extractHeaderValue(headers, [
    "x-litellm-request-id",
    "x-litellm-call-id",
    "x-request-id",
    "request-id",
  ]);
}

function extractCostUsd(body: unknown, headers: Headers): number | undefined {
  if (!isRecord(body)) {
    const headerCost = extractHeaderValue(headers, [
      "x-litellm-response-cost",
      "x-response-cost",
      "response-cost",
    ]);

    return toFiniteNumber(headerCost);
  }

  const candidates: unknown[] = [
    body.response_cost,
    body.cost,
    body.litellm_response_cost,
  ];

  if (isRecord(body._hidden_params)) {
    candidates.push(
      body._hidden_params.response_cost,
      body._hidden_params.cost,
      body._hidden_params.litellm_response_cost,
    );
  }

  for (const candidate of candidates) {
    const parsed = toFiniteNumber(candidate);

    if (parsed !== undefined) {
      return parsed;
    }
  }

  const headerCost = extractHeaderValue(headers, [
    "x-litellm-response-cost",
    "x-response-cost",
    "response-cost",
  ]);

  return toFiniteNumber(headerCost);
}

function extractProvider(body: unknown): string | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  if (typeof body.provider === "string") {
    return body.provider;
  }

  if (isRecord(body._hidden_params)) {
    if (typeof body._hidden_params.custom_llm_provider === "string") {
      return body._hidden_params.custom_llm_provider;
    }

    if (typeof body._hidden_params.litellm_provider === "string") {
      return body._hidden_params.litellm_provider;
    }
  }

  const model = extractModel(body);

  if (model?.includes("/")) {
    const [provider] = model.split("/", 1);

    if (provider) {
      return provider;
    }
  }

  return undefined;
}

function extractModel(body: unknown): string | undefined {
  if (isRecord(body) && typeof body.model === "string") {
    return body.model;
  }

  return undefined;
}

function extractProviderErrorCode(body: unknown): string | undefined {
  if (!isRecord(body) || !isRecord(body.error)) {
    return undefined;
  }

  const code = body.error.code;

  if (typeof code === "string" || typeof code === "number") {
    return String(code);
  }

  return undefined;
}

function sanitizeLiteLlmErrorMessage(body: unknown, status: number): string {
  if (isRecord(body) && isRecord(body.error) && typeof body.error.message === "string") {
    return truncateMessage(body.error.message);
  }

  if (isRecord(body) && typeof body.message === "string") {
    return truncateMessage(body.message);
  }

  return truncateMessage(`LiteLLM proxy responded with HTTP ${status}`);
}

/**
 * Sends a chat completion request to the LiteLLM proxy.
 *
 * This is the only place app code should call the LiteLLM proxy directly.
 * Prompt/response text is returned to the caller but never persisted or logged.
 */
export async function sendLiteLlmChatCompletion(input: {
  model?: string;
  messages: ChatMessage[];
  metadata: LiteLlmMetadata;
}): Promise<LiteLlmCompletionResult> {
  const config = getLiteLlmClientConfig();
  const model = input.model?.trim() || config.defaultModel;
  const startedAt = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.proxyUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.masterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        metadata: input.metadata,
        tags: buildLiteLlmTags(input.metadata),
      }),
      signal: controller.signal,
    });

    const body = await parseJsonSafely(response);
    const externalLiteLlmRequestId = extractRequestId(body, response.headers);

    if (!response.ok) {
      const providerErrorCode = extractProviderErrorCode(body);

      throw new LiteLlmClientError(
        sanitizeLiteLlmErrorMessage(body, response.status),
        response.status,
        {
          model,
          appRequestId: input.metadata.app_request_id,
          ...(providerErrorCode ? { providerErrorCode } : {}),
        },
      );
    }

    const usage = extractUsage(body);
    const costUsd = extractCostUsd(body, response.headers);
    const provider = extractProvider(body);

    logger.info(
      {
        appRequestId: input.metadata.app_request_id,
        organizationId: input.metadata.organization_id,
        source: input.metadata.source,
        model: extractModel(body) ?? model,
        provider,
        status: response.status,
        latencyMs: Date.now() - startedAt,
        externalLiteLlmRequestId,
        ...(usage?.inputTokens !== undefined
          ? { inputTokens: usage.inputTokens }
          : {}),
        ...(usage?.outputTokens !== undefined
          ? { outputTokens: usage.outputTokens }
          : {}),
        ...(usage?.totalTokens !== undefined
          ? { totalTokens: usage.totalTokens }
          : {}),
        ...(costUsd !== undefined ? { costUsd } : {}),
      },
      "LiteLLM chat completion completed",
    );

    return {
      content: extractAssistantContent(body),
      ...(provider ? { provider } : {}),
      model: extractModel(body) ?? model,
      ...(usage ? { usage } : {}),
      ...(costUsd !== undefined ? { costUsd } : {}),
      ...(externalLiteLlmRequestId
        ? { externalLiteLlmRequestId }
        : {}),
    };
  } catch (error) {
    if (error instanceof LiteLlmClientError) {
      throw error;
    }

    const isTimeout = error instanceof Error && error.name === "AbortError";

    logger.error(
      {
        err: isTimeout ? "Request timed out" : error,
        appRequestId: input.metadata.app_request_id,
        organizationId: input.metadata.organization_id,
        source: input.metadata.source,
        model,
        latencyMs: Date.now() - startedAt,
      },
      "LiteLLM proxy request failed",
    );

    throw new LiteLlmClientError(
      isTimeout ? "LiteLLM proxy request timed out" : "LiteLLM proxy request failed",
      0,
      {
        model,
        appRequestId: input.metadata.app_request_id,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}
