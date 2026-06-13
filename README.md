# Slate

Production-quality MVP scaffold for Slate, an AI job-costing SaaS built for
agencies. The app is designed to track AI usage by agency, client, project,
user, workflow, and Slack channel.

## Stack

- Next.js 15 with App Router
- TypeScript in strict mode
- Tailwind CSS
- shadcn/ui-style component setup
- Prisma + PostgreSQL
- Zod environment validation
- Pino structured logging

## Project structure

```text
app/
  (auth)/
  (dashboard)/
  api/
components/
lib/
  auth/
  db/
  jobs/
  litellm/
  security/
  slack/
prisma/
scripts/
```

## Local setup

1. Install Node.js 20+ and Docker Desktop (or another Docker Engine with Compose support).
2. Copy the environment template:

```bash
cp .env.example .env
```

3. Install dependencies:

```bash
npm install
```

4. Start the local infrastructure:

```bash
docker compose up -d
```

This starts:

- PostgreSQL 16 on `localhost:5432`
- LiteLLM proxy on `localhost:4000`

The Postgres container hosts two databases:

- `cost_tracking_ai` — the app database, managed by Prisma
- `litellm` — LiteLLM's internal tables, never touched by Prisma

On a fresh volume, `docker/postgres-init/01-create-litellm-db.sh` creates the
`litellm` database automatically. If you have an existing volume from an
earlier setup, create it once manually:

```bash
docker compose exec postgres psql -U postgres -c "CREATE DATABASE litellm;"
```

Keeping LiteLLM in its own database guarantees `prisma db push` never warns
about or drops LiteLLM internal tables.

5. Validate the environment:

```bash
npm run check:env
```

6. Generate the Prisma client and push the schema to your local database:

```bash
npm run db:generate
npm run db:push
```

7. Optionally seed local demo data:

```bash
npm run db:seed
```

8. Start the development server and durable worker in separate terminals:

```bash
npm run dev
```

```bash
npm run worker
```

`QUEUE_ADAPTER=postgres` (default outside tests) persists jobs in the app
database. `QUEUE_ADAPTER=in-memory` is local/test only and is not durable.

Inspect recent durable jobs:

```bash
docker compose exec postgres psql -U postgres -d cost_tracking_ai -c '
SELECT id, type, status, attempts, "runAfter", "lockedAt", "lastError", "createdAt", "updatedAt"
FROM "BackgroundJob"
ORDER BY "createdAt" DESC
LIMIT 20;
'
```

Open [http://localhost:3000](http://localhost:3000) for the landing page or
[http://localhost:3000/dashboard](http://localhost:3000/dashboard) for the app shell.
The internal jobs page lives at [http://localhost:3000/jobs](http://localhost:3000/jobs).

## Environment variables

The server validates these variables through `lib/env.ts`.

Required at boot:

- `DATABASE_URL`
- `APP_BASE_URL`
- `ENCRYPTION_KEY`

Optional at boot (integrations):

- `LITELLM_PROXY_URL`
- `LITELLM_MASTER_KEY`
- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN`

- `QUEUE_ADAPTER` (`postgres` or `in-memory`; defaults to `postgres` in dev/prod and `in-memory` in tests)

  Bot token used by `lib/slack/client.ts` for `chat.postMessage`, `chat.update`,
  and recovering original message text via `conversations.history` /
  `conversations.replies`. Required scopes include `channels:history`,
  `groups:history`, `im:history`, and `mpim:history` (plus posting scopes for
  your channel types).

Integration variables can be absent and the app still starts. Routes and jobs
that actually need an integration call `assertLiteLLMConfigured()` or
`assertSlackConfigured()` and fail with a clear error at that point. The
homepage and `/api/health` distinguish `Missing`, `Dev placeholder`, and
`Configured` credential states.

These variables are intentionally server-only and are not exposed through
`NEXT_PUBLIC_*` names.

`.env` is gitignored and must never contain committed real provider keys. The
`.env.example` placeholders are intentionally fake.

## Slack OAuth setup for Slate

Pilot customers should connect Slack through OAuth instead of manual database scripts.

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps).
2. Add redirect URL:

```text
https://<your-ngrok-subdomain>.ngrok-free.app/api/slack/oauth/callback
```

For local development with ngrok:

```text
https://your-ngrok-subdomain.ngrok-free.app/api/slack/oauth/callback
```

3. Set these env vars locally (never commit real values):

```env
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=
SLACK_SIGNING_SECRET=
```

4. Start the app and worker:

```bash
npm run dev
npm run worker
```

5. Open `/slack` and click **Connect Slack**.
6. After OAuth completes, `/slack` should show the connected workspace, team ID, and bot installed status.

Local development scripts such as `scripts/upsert-local-slack-workspace.ts` remain available for seeded/fake workspaces, but OAuth is the preferred pilot path.

## Docker services

Bring up the local services:

```bash
docker compose up -d
```

Confirm LiteLLM is running:

```bash
curl http://localhost:4000/health/liveliness
```

If you want to inspect the advertised models through the proxy:

```bash
curl http://localhost:4000/v1/models \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY"
```

Run Prisma migrations against the same Postgres instance started by Compose:

```bash
npm run db:migrate
```

If your local `.env` predates this Docker setup, update `DATABASE_URL` to:

```bash
postgresql://postgres:postgres@localhost:5432/cost_tracking_ai?schema=public
```

## LiteLLM integration test

This repo includes a development-only proxy test route at:

```text
app/api/litellm-test/route.ts
```

Use it to verify that the Next.js app can reach a local LiteLLM proxy without
putting real provider credentials into the app.

1. Validate the local environment:

```bash
npm run check:env
```

2. Start the Next.js dev server:

```bash
npm run dev
```

3. Start LiteLLM locally in a separate terminal. You can use Docker Compose:

```bash
docker compose up -d litellm postgres
```

This local setup uses the app's fake/dev `LITELLM_MASTER_KEY`. The proxy itself
can still return a provider authentication or model error if you leave provider
keys fake, which is acceptable for this milestone because it still proves app to
proxy connectivity.

4. Visit the local test route:

```bash
http://localhost:3000/api/litellm-test
```

The route returns a sanitized shape — never the raw upstream response:

```json
{
  "ok": false,
  "status": 401,
  "message": "litellm.AuthenticationError: ... (truncated)",
  "providerErrorCode": "401"
}
```

Expected behavior:

- If the proxy is not running, the route returns `ok: false` with a clean
  unreachable message.
- If the proxy is running but provider keys are still fake, the route returns
  a bounded upstream auth/config message. This is intentional: fake provider
  keys produce upstream auth errors instead of real API charges, while still
  proving app-to-proxy connectivity.
- With a real provider key in LiteLLM, the route returns `ok: true` with the
  model name.

The route never returns `LITELLM_MASTER_KEY`, provider API keys, or raw
provider response JSON.

## Background jobs

`lib/jobs/queue.ts` provides the job abstraction used by Slack ingestion:

```ts
await enqueueJob("slack.ai_request", payload);
```

The current implementation is an **in-process, local-development-only**
dispatcher built on `setImmediate`. It is not durable: jobs are lost if the
process crashes or restarts, and it does not work across serverless
invocations. It exists so route handlers stay thin (Slack requires a 2xx
acknowledgment within ~3 seconds) and will be replaced by a durable queue
(Inngest, Trigger.dev, BullMQ, SQS, or a dedicated worker) before production.

Local signed Slack event testing (no ngrok, no real Slack API):

```bash
npm run simulate:slack -- --team T_DEMO --channel C_ACME --text "@YourBot draft a client update"
```

See `scripts/simulate-slack-event.ts` for CLI options (`C_UNMAPPED`, `T_UNKNOWN`, etc.).

## Usage and cost tracking

Real ingestion writes to two tables:

- `AiRequestAudit` — request lifecycle/status (QUEUED → PROCESSING →
  COMPLETED/FAILED), Slack attribution metadata, bounded error messages.
  Lifecycle writes go through `lib/ai/requests.ts`.
- `AiUsageEvent` — normalized usage/cost facts per model call: provider,
  model, token counts, latency, and costs stored as integer micros
  (1 USD = 1,000,000 micros) to avoid precision loss during aggregation.
  Conversion helpers live in `lib/db/costs.ts` (`usdToMicros`,
  `microsToUsdDecimal`, `formatUsdFromMicros`).

Prompt text is not stored by default, matching the `METADATA_ONLY` privacy
default in `OrganizationPrivacySettings`.

## Analytics architecture (spend dashboard prep)

Before building dashboard spend cards, the analytics strategy was validated
against the live local LiteLLM schema.

**Database ownership**

- `cost_tracking_ai` (Prisma) — app business data: organizations, clients,
  projects, Slack mappings, revenue, `AiRequestAudit`, and normalized
  `AiUsageEvent` facts written by the Slack worker.
- `litellm` (LiteLLM only) — raw proxy spend logs such as
  `"LiteLLM_SpendLogs"`, plus LiteLLM daily rollups
  (`LiteLLM_DailyUserSpend`, `LiteLLM_DailyTeamSpend`, `LiteLLM_DailyTagSpend`,
  etc.).

These are separate Postgres databases on the same server. Prisma `db:push`
against `cost_tracking_ai` does not touch LiteLLM internal tables.

**LiteLLM raw spend logs**

The primary per-request spend table is `"LiteLLM_SpendLogs"`. Relevant columns
include:

- `request_id`, `spend`, `prompt_tokens`, `completion_tokens`, `total_tokens`
- `model`, `custom_llm_provider`, `status`, `"startTime"`, `request_duration_ms`
- `metadata` (jsonb), `request_tags` (jsonb), `organization_id`, `team_id`

Local dev currently has only failed `/api/litellm-test` proxy attempts in
`LiteLLM_SpendLogs` (zero spend, empty `request_tags`). App metadata/tags from
`sendLiteLlmChatCompletion` (`organization_id`, `client_id`, `app_request_id`,
`org:…`, `client:…`, etc.) are **expected** to appear in successful spend rows
but are **unverified** until a successful Slack worker → LiteLLM call runs with
real provider keys.

**Privacy**

- LiteLLM owns raw spend logs.
- The app owns business attribution, revenue, margin, and UX.
- Prompt/response text is not stored by default.
- App-facing dashboard and profitability analytics read normalized
  `AiUsageEvent` facts. Raw LiteLLM spend logs stay in LiteLLM and are used only
  for reconciliation/provider drill-down when needed.

**Why not a SQL view yet**

A view inside `cost_tracking_ai` cannot select from `litellm` tables without
`postgres_fdw`, `dblink`, or collapsing into one database with separate
schemas. That adds operational complexity and is brittle for local/prod.

**Future raw-log implementation (Option A)**

Use a separate **read-only analytics connection** to the `litellm` database
(later: `LITELLM_ANALYTICS_DATABASE_URL`) and normalize rows in TypeScript via
`lib/analytics/spend.ts`. Query `"LiteLLM_SpendLogs"` (and optionally
`LiteLLM_DailyTagSpend` for rollups) without copying raw rows into Prisma
models.

For MVP dashboard cards, prefer **`AiUsageEvent` in the app DB** first — it
already stores normalized token/cost facts plus client/project/workflow
attribution from the Slack worker, with no prompt/response text. Use the
read-only LiteLLM connection later for reconciliation, provider-level drill-down,
or gaps where the worker did not write `AiUsageEvent`.

**Not chosen yet**

- Option B — `postgres_fdw` / `dblink` + cross-DB SQL view (`app_ai_spend_events`)
- Option C — same database, different schema (requires explicit architecture approval)

**Next implementation step**

Add `lib/analytics/spend.ts` with a read-only LiteLLM Postgres client, typed
row mappers for `"LiteLLM_SpendLogs"`, and dashboard query helpers that join
normalized spend facts to app attribution — starting with `AiUsageEvent`, then
optional LiteLLM reconciliation once successful spend rows exist.

## Phase 2 controlled real testing

See [`docs/phase-2-controlled-real-testing.md`](docs/phase-2-controlled-real-testing.md).

Real credentials must never be committed. Use `.env.phase2.example` as a placeholder
template and copy values into local `.env`.

## Included infrastructure

- `lib/env.ts` validates runtime configuration with Zod.
- `lib/db/prisma.ts` exposes a Prisma singleton for server-side usage.
- `app/api/litellm-test/route.ts` provides a development-only LiteLLM proxy connectivity test.
- `middleware.ts` applies baseline security headers.
- `docker-compose.yml` provisions local PostgreSQL and LiteLLM proxy services.
- `litellm.config.yaml` defines local placeholder OpenAI and Anthropic model routes.
- `prisma/schema.prisma` models organizations, memberships, clients, projects,
  workflow types, Slack mappings, revenue records, privacy settings, and
  app-level AI request audits.
- `app/api/health/route.ts` exposes a simple health endpoint for local checks.

## Not implemented yet

- Authentication and session management
- Slack OAuth install and workspace sync (manual `/slack` mapping + seed data only)
- Durable background job execution (current queue is in-process, dev-only)
- Dashboard spend cards and LiteLLM spend reconciliation (`lib/analytics/spend.ts`)
- Client/project select menu completion in Slack assignment Block Kit

**Implemented in Step 1 (mock/local):** Slack Events → queue → worker
(UNKNOWN_WORKSPACE / UNMAPPED / MAPPED), interactivity resume, assignment message
updates, centralized Slack client helpers, fake workspace seed (`T_DEMO` /
`C_ACME`), `/slack` manual mapping CRUD, signed event simulation
(`npm run simulate:slack`), and privacy regression tests.

The shell and schema are ready for controlled real testing without hiding business
logic inside UI components.
