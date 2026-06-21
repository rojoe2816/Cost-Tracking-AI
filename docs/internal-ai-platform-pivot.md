# Slate internal AI platform pivot

This document records the product and architecture direction change before Phase 5 implementation begins. It describes what exists today, what we are keeping, what we are deprioritizing, and what we will build next.

---

## 1. New product scope

Slate is becoming:

> **A cost, usage, and attribution platform for internal company AI tools.**

The new core use case:

> Employees use an internal AI-native company website to access company data and complete tasks. Slate tracks who used AI, for what client/project/workflow, which model/provider was used, how many tokens were consumed, what it cost, and how that affects client profitability.

Slate is no longer positioned primarily as a Slack cost-attribution tool. Slack remains supported, but the MVP demo path shifts to internal AI applications that employees use to do real work.

---

## 2. What changed from the Slack-first architecture

The original proof-of-concept flow was:

```text
Slack mention
→ Slate Slack event route
→ durable BackgroundJob
→ worker
→ LiteLLM
→ OpenAI
→ AiRequestAudit
→ AiUsageEvent
→ dashboard / client profitability
```

That flow is implemented and tested. It proved that Slate can:

- Accept AI requests from an external surface
- Route them through LiteLLM
- Record lifecycle and usage facts
- Attribute spend to clients, projects, and workflows
- Reconcile LiteLLM spend logs
- Surface results on the dashboard and `/clients`

The pivot does not throw away that work. It generalizes the pattern.

**Slack becomes one source of AiUsageEvent, not the product itself.**

Slack is still valuable:

- Many agencies already work in Slack
- Channel-based attribution maps naturally to client/project defaults
- OAuth install and assignment UX are production-ready connectors

But the primary MVP should now be **source-agnostic** and centered on **internal AI applications** — the websites and tools employees use to access company data and complete tasks.

---

## 3. What we keep from the existing codebase

These components remain core infrastructure:

| Component | Why it still matters |
|---|---|
| **LiteLLM client** (`lib/litellm/client.ts`) | Central gateway to model providers; already handles chat completions, metadata tags, request IDs, and error classification. |
| **LiteLLM spend reconciliation** (`lib/analytics/litellmSpendReconciliation.ts`) | Validates Slate-recorded costs against LiteLLM `LiteLLM_SpendLogs`; essential for accurate billing regardless of request source. |
| **AiRequestAudit** | Request lifecycle table (queued → processing → completed/failed). Tracks attribution context and external LiteLLM request ID without storing prompt/response text. |
| **AiUsageEvent** | Normalized usage/cost ledger (tokens, micros-based cost, provider, model, attribution). Powers dashboard and profitability. |
| **Dashboard analytics** (`lib/analytics/usage.ts`, `app/(dashboard)/dashboard/page.tsx`) | Reads from `AiUsageEvent` for spend summaries, breakdowns by client/workflow/source, and recent requests. |
| **Client profitability** (`lib/analytics/profitability.ts`, `app/(dashboard)/clients/page.tsx`) | Combines AI spend with `ClientRevenue` to show margin impact per client/project. |
| **ClientRevenue workflow** | Monthly revenue and labor cost inputs that make profitability meaningful. |
| **BackgroundJob queue** (`lib/queue/`, `lib/jobs/`) | Durable Postgres-backed async processing with retries and idempotency. Useful for Slack and future async gateway patterns. |
| **Encryption helpers** (`lib/security/encryption.ts`) | AES-256-GCM for secrets such as Slack bot tokens; reusable for future source-app API keys. |
| **Slack integration** (`lib/slack/`, `app/api/slack/`) | Optional connector — OAuth install, events, interactivity, channel mapping, assignment UX. |
| **Privacy tests** (`lib/privacy/metadataOnly.test.ts`) | Guardrails ensuring prompt/response text is not persisted by default. |

Current schema already supports multi-source attribution at a basic level:

- `AiRequestSource` enum includes `SLACK` and `WEB`
- `AiRequestAudit` and `AiUsageEvent` carry `clientId`, `projectId`, `workflowTypeId`
- Slack-specific columns (`slackTeamId`, `slackChannelId`, etc.) exist but are optional on each row

---

## 4. What becomes optional / deprioritized

These remain in the codebase and should keep passing tests, but they are **not** the main MVP demo path:

| Area | Current location | Status |
|---|---|---|
| Slack OAuth | `app/api/slack/install/`, `app/api/slack/oauth/callback/` | Working; optional connector onboarding |
| Slack channel mapping | `app/(dashboard)/slack/`, `lib/slack/mappings.ts` | Working; not required for internal portal MVP |
| Slack assignment UX | `lib/slack/interactivity.ts` | Working; Slack-specific attribution override |
| Slack interactivity | `app/api/slack/interactivity/route.ts` | Working; 3-second ack preserved |
| Slack event routes | `app/api/slack/events/route.ts` | Working; enqueues `slackAiRequest` jobs |

Local development scripts (`scripts/upsert-local-slack-workspace.ts`, `scripts/upsert-real-slack-channel-mapping.ts`, Slack simulation scripts) also remain for connector testing.

---

## 5. New target architecture

The new main flow:

```text
Mock AI Native Company Website
→ Slate AI Gateway
→ LiteLLM
→ Model provider
→ Slate records AiRequestAudit + AiUsageEvent
→ Dashboard / client profitability update
```

### Metadata Slate should capture

For each AI task, Slate should record (metadata only by default):

| Field | Purpose |
|---|---|
| **organization** | Tenant isolation |
| **employee** | Who initiated the request (new model in Phase 5A) |
| **source app** | Which internal tool sent the request (new model in Phase 5A) |
| **client** | Billable client attribution |
| **project** | Project-level cost allocation |
| **workflow type** | Workflow/category for reporting |
| **task type** | Specific task within the portal (e.g. summarize, draft, analyze) |
| **model** | Model identifier from LiteLLM |
| **provider** | Underlying provider (OpenAI, Anthropic, etc.) |
| **tokens** | Prompt, completion, and total token counts |
| **cost** | Input/output/total cost in micros |
| **request id** | Slate audit ID + external LiteLLM request ID |
| **timestamp** | When usage occurred |

Slack-sourced events continue to populate the same tables using Slack-specific columns where relevant; internal portal events use employee and source-app fields instead.

---

## 6. Mock AI-native company website

### Purpose

> A demo/test internal company AI portal that simulates how a real company's employees would use AI to complete work.

This portal is the primary Phase 5 MVP surface. It exercises the full attribution and cost-tracking pipeline without requiring Slack.

### Planned UI (Phase 5B)

- Employee selector
- Client selector
- Project selector
- Workflow selector
- Task type selector
- Model selector
- Prompt / input field
- Run AI task button
- AI response display (returned to browser; not stored by default)
- Usage / cost summary after completion

### Recommended route: `/company-ai`

**Recommendation:** use `/company-ai` rather than `/mock-company`.

| Route | Pros | Cons |
|---|---|---|
| `/mock-company` | Clearly signals test data | Sounds disposable; awkward in pilot demos |
| **`/company-ai`** | Reads as a product feature; works for demos and eventual real portal | Slightly less explicit that it is seeded demo data |

`/company-ai` can host a demo organization’s internal portal today and evolve into a template for real customer integrations. Demo disclaimers belong in page copy, not the URL.

---

## 7. New source-agnostic AI gateway

### Proposed route

```text
POST /api/ai/gateway
```

### Expected behavior

1. Accept prompt/input and attribution metadata (organization, employee, source app, client, project, workflow, task type, model).
2. Validate source app and organization context.
3. Create `AiRequestAudit` (status `PROCESSING` → `COMPLETED` or `FAILED`).
4. Call LiteLLM via existing client (`lib/litellm/client.ts`).
5. Record `AiUsageEvent` with tokens, cost, provider, model, and attribution.
6. Reconcile spend via LiteLLM request ID when available.
7. Return AI response to the internal portal (response text is **not** persisted by default).
8. Log structured metadata only — never log raw prompts, responses, or secrets.

The gateway should mirror the proven Slack worker pattern but run synchronously for the portal UX (async via `BackgroundJob` remains available for long-running or webhook-style sources).

---

## 8. Data model changes needed later

Phase 5A will likely add:

| Addition | Purpose |
|---|---|
| **`Employee`** | Represents company employees who use internal AI tools |
| **`AiSourceApp`** | Registered internal applications (portal, future integrations) |
| **`sourceAppId` on `AiUsageEvent`** | Which app generated the usage |
| **`employeeId` on `AiUsageEvent` and/or `AiRequestAudit`** | Who initiated the request |
| **`taskType` on `AiUsageEvent` and/or `AiRequestAudit`** | Granular task classification within a workflow |
| **Source enum or string expansion** | Extend `AiRequestSource` beyond `SLACK` / `WEB` (e.g. `INTERNAL_PORTAL`, or dynamic source-app reference) |

Slack-specific columns (`slackTeamId`, `slackChannelId`, `slackUserId`, etc.) **remain** on existing models. They should be populated for Slack events and left null for internal portal events — Slack fields must not be required for non-Slack usage.

**Phase 5A (complete):** `Employee`, `AiSourceApp`, and nullable attribution fields on `AiRequestAudit` / `AiUsageEvent` are implemented. Backend helpers live in `lib/internal-ai/` and `lib/analytics/internalUsage.ts`. Demo seed data includes employees and source apps for Demo Agency.

---

## 9. Privacy model

Reaffirmed defaults:

- **Prompt text is not stored by default.**
- **AI response text is not stored by default.**
- Slate stores **metadata, tokens, cost, model/provider, and attribution** only.
- `OrganizationPrivacySettings.promptStorageMode` defaults to `METADATA_ONLY`.
- Any future opt-in prompt/response storage must be:
  - Explicit per organization
  - Governed by `PromptStorageMode` (`REDACTED` or `FULL_LOGGING`)
  - Implemented as a separate, auditable code path
  - Covered by dedicated tests

The mock portal and AI gateway must not weaken these defaults.

---

## 10. Revised phases

### Phase 5A — Source-agnostic usage model ✅

**Status:** Complete.

**Delivered:**

- `Employee` and `AiSourceApp` Prisma models (organization-scoped, nullable relations)
- Nullable `employeeId`, `sourceAppId`, `taskType` on `AiUsageEvent`
- Nullable `employeeId`, `sourceAppId`, `taskType`, `sourceAppRequestId` on `AiRequestAudit`
- Demo seed employees and source apps in `prisma/seed.ts`
- `getInternalAiContextOptions()` in `lib/internal-ai/context.ts`
- `validateInternalAiAttribution()` in `lib/internal-ai/usageAttribution.ts`
- Analytics in `lib/analytics/internalUsage.ts`: spend by employee, source app, task type; recent internal usage query
- Slack backward compatibility preserved (Slack events omit new fields)

**Do not break:** Slack integration, LiteLLM reconciliation, profitability math, privacy defaults.

---

### Phase 5B — Source app authentication and API key hashing

**Goal:** Authenticate internal apps calling the future gateway (hashed API keys per `AiSourceApp`, encrypted at rest).

**Files likely touched:** `lib/security/`, `AiSourceApp` schema extension, auth middleware stubs, tests.

**Completion criteria:**

- Each registered source app can have credentials
- Gateway auth rejects unauthenticated or cross-org requests (when gateway lands in 5C)
- Secrets encrypted at rest using existing encryption helpers

**Do not break:** Demo org local dev flow (provide dev bypass or seeded keys).

---

### Phase 5C — Source-agnostic AI gateway

**Goal:** Implement `POST /api/ai/gateway` using existing LiteLLM client and audit/usage recording.

**Files likely touched:** `app/api/ai/gateway/route.ts`, new `lib/ai/gateway.ts`, LiteLLM client metadata tags, tests with mocked LiteLLM.

**Completion criteria:**

- Gateway creates `AiRequestAudit` + `AiUsageEvent` with employee/source/task attribution
- LiteLLM called through existing client (no direct provider calls under `app/api`)
- Response returned to caller; prompt/response not persisted
- Spend reconciliation hooks work with LiteLLM request ID

**Do not break:** Slack job handler, existing analytics queries, privacy tests.

---

### Phase 5D — Mock AI-native company website

**Goal:** Build `/company-ai` demo portal with selectors, prompt input, run button, response display, and post-task usage summary.

**Files likely touched:** `app/(dashboard)/company-ai/` or `app/company-ai/`, new components.

**Completion criteria:**

- User can select employee, client, project, workflow, task type, and model
- Portal calls the Phase 5C gateway
- UI shows response and usage summary without storing prompt/response in DB

**Do not break:** Existing dashboard, `/clients`, Slack pages.

---

### Phase 5E — Internal AI usage dashboard

**Goal:** Update dashboard and `/clients` to surface employee, source app, and task type dimensions.

**Files likely touched:** `lib/analytics/usage.ts`, `lib/analytics/internalUsage.ts`, dashboard and clients pages.

**Completion criteria:**

- Dashboard shows spend/tokens by source app and employee
- Recent requests table includes source app and employee
- Clients profitability reflects internal portal usage
- Slack-sourced data still appears correctly

**Do not break:** Existing spend-by-client/workflow/source breakdowns.

---

### Phase 5F — Real company integration guide

**Goal:** Document how a real company connects an internal AI tool to Slate.

**Files likely touched:** `README.md`, `docs/company-integration-guide.md` (new), `.env.example`.

**Completion criteria:**

- Step-by-step guide: register source app, configure LiteLLM, call gateway, verify dashboard
- Security and privacy checklist included
- Slack connector documented as optional parallel path

**Do not break:** Existing Slack OAuth documentation.

---

### Previous phase labels (superseded)

The original pivot doc labeled mock portal as 5B and auth as 5E. Build order is now **5B auth → 5C gateway → 5D mock portal → 5E dashboard**, so backend gateway and credentials exist before the demo UI.

---

## 11. Success criteria for the new MVP

The new MVP is successful when:

1. A user opens the mock company AI portal (`/company-ai`).
2. Selects employee, client, project, workflow, and task type.
3. Runs an AI task.
4. Slate routes the call through LiteLLM.
5. The mock portal receives an AI response.
6. `AiRequestAudit` and `AiUsageEvent` are created.
7. Dashboard shows cost / tokens / source / employee.
8. Clients page shows profitability impact.
9. Slack remains available but is not required.
10. Prompt / response text is not stored.

---

## Appendix: Current codebase map (as of Phase 5A)

For implementers referencing what exists today:

| Area | Key paths |
|---|---|
| Schema | `prisma/schema.prisma` |
| Employees / source apps | `Employee`, `AiSourceApp` models; `prisma/seed.ts` |
| Internal AI helpers | `lib/internal-ai/context.ts`, `lib/internal-ai/usageAttribution.ts` |
| Internal usage analytics | `lib/analytics/internalUsage.ts` |
| LiteLLM | `lib/litellm/client.ts` |
| Usage analytics | `lib/analytics/usage.ts` |
| Profitability | `lib/analytics/profitability.ts` |
| Spend reconciliation | `lib/analytics/litellmSpendReconciliation.ts` |
| Job queue | `lib/queue/postgresQueue.ts`, `lib/queue/worker.ts` |
| Slack jobs | `lib/jobs/handlers/slackAiRequest.ts` |
| Dashboard | `app/(dashboard)/dashboard/page.tsx` |
| Clients | `app/(dashboard)/clients/page.tsx` |
| Slack UI | `app/(dashboard)/slack/page.tsx` |
| Slack API | `app/api/slack/events/`, `interactivity/`, `install/`, `oauth/callback/` |
| Privacy tests | `lib/privacy/metadataOnly.test.ts` |

Slack remains an optional connector. Internal portal UI (`/company-ai`) and `POST /api/ai/gateway` are planned for Phases 5C–5D.
