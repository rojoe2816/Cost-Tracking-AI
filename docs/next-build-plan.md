# Next build plan

Immediate implementation sequence after [Phase 5A](./internal-ai-platform-pivot.md). See the pivot doc for full goals and completion criteria.

## Completed

- **Phase 5A — Source-agnostic data model** — `Employee`, `AiSourceApp`, attribution fields, context/validation helpers, internal usage analytics, demo seed data.

## Build order (next)

1. **Phase 5B — Source app authentication and API key hashing**
   - Hashed/encrypted credentials per `AiSourceApp`.
   - Auth validation helper for future gateway.

2. **Phase 5C — Source-agnostic AI gateway**
   - `POST /api/ai/gateway` using LiteLLM client + audit/usage recording (mocked in tests).

3. **Phase 5D — Mock company portal**
   - `/company-ai` with selectors, prompt input, run task, response + usage summary UI.

4. **Phase 5E — Dashboard updates**
   - Surface employee, source app, and task type on dashboard and `/clients`.

## Out of scope for the next sequence

- Removing or refactoring Slack code
- Real company integration guide (Phase 5F)

## Constraints (all phases)

- No prompt/response text stored by default
- No direct paid provider calls in tests
- No secrets committed
- Slack integration must remain working
