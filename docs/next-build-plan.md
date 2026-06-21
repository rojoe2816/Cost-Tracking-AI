# Next build plan

Immediate implementation sequence after [Phase 5B](./internal-ai-platform-pivot.md). See the pivot doc for full goals and completion criteria.

## Completed

- **Phase 5A — Source-agnostic data model** — `Employee`, `AiSourceApp`, attribution fields, context/validation helpers, internal usage analytics, demo seed data.
- **Phase 5B — Source app authentication** — `AiSourceAppCredential`, HMAC key hashing, bearer auth helpers, revoke/list, dev key script.

## Build order (next)

1. **Phase 5D — Gateway integration hardening and backend reporting endpoints**
   - Operational hardening, reporting APIs, optional idempotency DB constraint.
   - Wire employee/source-app/task-type dimensions into backend reporting before mock portal UI.

2. **Phase 5E — Mock company portal**
   - `/company-ai` with selectors, prompt input, run task, response + usage summary UI.

3. **Phase 5F — Dashboard updates**
   - Surface employee, source app, and task type on dashboard and `/clients`.

## Completed (continued)

- **Phase 5C — Source-agnostic AI gateway** — `POST /api/ai/gateway`, bearer auth, attribution validation, LiteLLM via existing client, audit/usage recording, idempotency (409 on duplicate `sourceAppRequestId`), mocked tests, `npm run gateway:test`.

## Out of scope for the next sequence

- Removing or refactoring Slack code
- Real company integration guide (Phase 5F)

## Constraints (all phases)

- No prompt/response text stored by default
- No direct paid provider calls in tests
- No secrets committed
- Slack integration must remain working
