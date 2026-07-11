# Deployment and Rollback Runbook

## Required isolation

Development, staging, and production use separate Postgres databases, LiteLLM
instances, source-app keys, provider credentials, encryption keys, domains, and
logs. Production secrets must live in the deployment platform's secret manager.

## Deployable services

1. Slate web/API.
2. Slate background worker.
3. Postgres with connection pooling and automated backups.
4. LiteLLM.
5. The mock customer application, deployed separately from Slate.

## Pre-deploy gates

```bash
npm run check:env
npm run typecheck
npm run lint
npm test
npm run build
```

Also run secret scanning, migration review, tenant-isolation tests, the two-app
integration test, and a controlled provider smoke test in staging.

## Deployment order

1. Confirm the latest backup and test restore metadata.
2. Apply reviewed Prisma migrations.
3. Deploy Slate API/web.
4. Deploy the Slate worker.
5. Verify `/api/v1/health`.
6. Deploy the mock/demo customer app independently.
7. Run a request under the fixed smoke-test budget and reconcile the Slate usage
   event with LiteLLM.

## Rollback

1. Stop new deployments and disable the affected source app if requests are
   unsafe.
2. Roll back web/API and worker to the previous image together.
3. Do not reverse a destructive migration without a reviewed down migration.
4. Restore from backup only after preserving incident evidence.
5. Run health, authentication, idempotency, and one low-cost gateway request.

## Alerts

Alert on gateway failure spikes, database or LiteLLM unavailability, cost
spikes, repeated invalid credentials, rate-limit spikes, queue failures, and
usage-event persistence failures. Logs must never include prompts, responses,
API keys, provider credentials, or authorization headers.
