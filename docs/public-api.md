# Slate Public API v1

Slate's public API is a server-to-server contract. Customer applications need
only a base URL and a source-app API key. They must not send that key to a
browser or mobile client.

## Authentication

Send the source-app key as a bearer token:

```http
Authorization: Bearer slate_app_sk_...
```

Keys are stored as HMAC hashes. A revoked credential or disabled source app is
rejected immediately. Every response includes `X-Request-Id`; error bodies also
contain `requestId`, `error.code`, and a safe `error.message`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/ai/gateway` | Route a model request and record attributed usage |
| `GET` | `/api/v1/context` | Load employees, clients, projects, workflows, and allowed models |
| `POST` | `/api/v1/context/employees/sync` | Idempotently upsert employees |
| `POST` | `/api/v1/context/clients/sync` | Idempotently upsert clients |
| `POST` | `/api/v1/context/projects/sync` | Idempotently upsert projects with client validation |
| `POST` | `/api/v1/context/workflows/sync` | Idempotently upsert workflows |
| `GET` | `/api/v1/reports/internal-ai` | Read organization-scoped usage summaries |
| `GET` | `/api/v1/health` | Read non-secret service health |

The older `/api/ai/gateway` route remains a compatibility endpoint for Slate
internal IDs. New integrations should use v1 and customer-owned external IDs.

## Gateway request

```json
{
  "employeeExternalId": "employee-427",
  "clientExternalId": "client-acme",
  "projectExternalId": "project-seo-001",
  "workflowExternalId": "client-update",
  "taskType": "client_update",
  "sourceAppRequestId": "request-001",
  "model": "gpt-4o-mini",
  "input": "Draft a brief client update."
}
```

`employeeExternalId`, `sourceAppRequestId`, and `input` are required. The input
is limited to 16,000 characters; the complete JSON body is limited to 64 KB.
`sourceAppRequestId` is the idempotency key. Reusing an ID returns `409` and does
not call the model again.

## Gateway response

```json
{
  "traceId": "sdk_...",
  "requestId": "cm...",
  "response": "The requested AI response.",
  "usage": {
    "model": "gpt-4o-mini",
    "provider": "openai",
    "inputTokens": 20,
    "outputTokens": 18,
    "totalTokens": 38,
    "costMicros": 11,
    "latencyMs": 812
  },
  "attribution": {
    "employeeExternalId": "employee-427",
    "clientExternalId": "client-acme",
    "projectExternalId": "project-seo-001",
    "workflowExternalId": "client-update",
    "taskType": "client_update",
    "sourceAppRequestId": "request-001"
  }
}
```

One USD equals 1,000,000 cost micros. Prompt and response content is transmitted
to fulfill the request but is not persisted in `AiRequestAudit` or
`AiUsageEvent`.

## Error codes

Common codes include `MISSING_AUTHORIZATION`, `INVALID_API_KEY`,
`CREDENTIAL_REVOKED`, `SOURCE_APP_INACTIVE`, `INVALID_BODY`,
`EMPLOYEE_NOT_FOUND`, `CLIENT_NOT_FOUND`, `PROJECT_NOT_FOUND`,
`PROJECT_CLIENT_MISMATCH`, `MODEL_NOT_ALLOWED`,
`DUPLICATE_SOURCE_APP_REQUEST`, `RATE_LIMITED`, and
`GATEWAY_PROCESSING_FAILED`.

Provider failures create a failed audit and no successful usage event. Error
responses never contain provider credentials, authorization headers, stack
traces, raw prompts, or raw responses.

## SDK

```ts
import { SlateClient } from "@slate-ai/sdk";

const slate = new SlateClient({
  apiKey: process.env.SLATE_API_KEY!,
  baseUrl: process.env.SLATE_BASE_URL!,
});

const result = await slate.run({
  employeeExternalId: "employee-427",
  clientExternalId: "client-acme",
  projectExternalId: "project-seo-001",
  workflowExternalId: "client-update",
  taskType: "client_update",
  sourceAppRequestId: crypto.randomUUID(),
  model: "gpt-4o-mini",
  input: "Draft a brief client update.",
});
```

The SDK handles authorization, JSON, timeouts, request IDs, typed errors, and a
bounded retry for transient failures. A gateway retry is enabled only when an
idempotency ID is present.

See `examples/` for TypeScript, Python, and cURL integrations.
