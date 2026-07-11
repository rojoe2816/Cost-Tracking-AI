import type {
  ClientSyncInput,
  EmployeeSyncInput,
  ProjectSyncInput,
  SlateApiErrorBody,
  SlateContext,
  SlateRunInput,
  SlateRunResult,
  SlateSyncResult,
  WorkflowSyncInput,
} from "@slate-ai/contracts";

export type {
  ClientSyncInput,
  EmployeeSyncInput,
  ProjectSyncInput,
  SlateContext,
  SlateRunInput,
  SlateRunResult,
  SlateSyncResult,
  WorkflowSyncInput,
} from "@slate-ai/contracts";

type FetchImplementation = typeof fetch;

export type SlateClientOptions = {
  apiKey: string;
  baseUrl: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetch?: FetchImplementation;
};

export class SlateApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly retryable: boolean;

  constructor(input: {
    message: string;
    status: number;
    code: string;
    requestId?: string | null;
    retryable?: boolean;
  }) {
    super(input.message);
    this.name = "SlateApiError";
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId ?? null;
    this.retryable = input.retryable ?? false;
  }
}

function normalizedBaseUrl(value: string): string {
  const parsed = new URL(value);
  return parsed.toString().replace(/\/$/, "");
}

function requestId(): string {
  return `sdk_${globalThis.crypto.randomUUID()}`;
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

export class SlateClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImplementation: FetchImplementation;

  constructor(options: SlateClientOptions) {
    if (!options.apiKey.trim()) {
      throw new Error("Slate apiKey is required.");
    }

    this.apiKey = options.apiKey.trim();
    this.baseUrl = normalizedBaseUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxRetries = options.maxRetries ?? 1;
    this.fetchImplementation = options.fetch ?? fetch;
  }

  getContext(): Promise<SlateContext> {
    return this.request("/api/v1/context", { method: "GET", retrySafe: true });
  }

  run(input: SlateRunInput): Promise<SlateRunResult> {
    return this.request("/api/v1/ai/gateway", {
      method: "POST",
      body: input,
      retrySafe: Boolean(input.sourceAppRequestId),
    });
  }

  syncEmployees(input: EmployeeSyncInput): Promise<SlateSyncResult> {
    return this.request("/api/v1/context/employees/sync", {
      method: "POST",
      body: input,
      retrySafe: true,
    });
  }

  syncClients(input: ClientSyncInput): Promise<SlateSyncResult> {
    return this.request("/api/v1/context/clients/sync", {
      method: "POST",
      body: input,
      retrySafe: true,
    });
  }

  syncProjects(input: ProjectSyncInput): Promise<SlateSyncResult> {
    return this.request("/api/v1/context/projects/sync", {
      method: "POST",
      body: input,
      retrySafe: true,
    });
  }

  syncWorkflows(input: WorkflowSyncInput): Promise<SlateSyncResult> {
    return this.request("/api/v1/context/workflows/sync", {
      method: "POST",
      body: input,
      retrySafe: true,
    });
  }

  private async request<T>(
    path: string,
    options: {
      method: "GET" | "POST";
      body?: unknown;
      retrySafe: boolean;
    },
  ): Promise<T> {
    const sdkRequestId = requestId();
    let lastError: SlateApiError | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
          method: options.method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Request-Id": sdkRequestId,
          },
          ...(options.body === undefined
            ? {}
            : { body: JSON.stringify(options.body) }),
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as
          | T
          | SlateApiErrorBody
          | null;

        if (response.ok) {
          return body as T;
        }

        const errorBody = body as SlateApiErrorBody | null;
        const retryable = options.retrySafe && isTransientStatus(response.status);
        lastError = new SlateApiError({
          status: response.status,
          code: errorBody?.error?.code ?? "SLATE_API_ERROR",
          message: errorBody?.error?.message ?? `Slate returned HTTP ${response.status}.`,
          requestId:
            errorBody?.requestId ?? response.headers.get("x-request-id") ?? sdkRequestId,
          retryable,
        });

        if (!retryable || attempt === this.maxRetries) {
          throw lastError;
        }
      } catch (error) {
        if (error instanceof SlateApiError) {
          if (!error.retryable || attempt === this.maxRetries) {
            throw error;
          }
          lastError = error;
        } else {
          const timedOut = error instanceof Error && error.name === "AbortError";
          lastError = new SlateApiError({
            status: 0,
            code: timedOut ? "SLATE_TIMEOUT" : "SLATE_UNAVAILABLE",
            message: timedOut
              ? "Slate did not respond before the request timed out."
              : "Could not connect to Slate.",
            requestId: sdkRequestId,
            retryable: options.retrySafe,
          });

          if (!options.retrySafe || attempt === this.maxRetries) {
            throw lastError;
          }
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw (
      lastError ??
      new SlateApiError({
        status: 0,
        code: "SLATE_UNAVAILABLE",
        message: "Could not connect to Slate.",
      })
    );
  }
}
