# Next build plan

Immediate implementation sequence after the [internal AI platform pivot](./internal-ai-platform-pivot.md). Each phase has full goals and criteria in that document.

## Build order

1. **Phase 5A — Source-agnostic data model**
   - Add `Employee`, `AiSourceApp`, and new attribution fields on audit/usage tables.
   - Update analytics types; keep Slack rows and tests green.

2. **Phase 5B — Mock company portal**
   - Ship `/company-ai` with selectors, prompt input, run task, response + usage summary UI.

3. **Phase 5C — AI gateway**
   - Implement `POST /api/ai/gateway` using LiteLLM client + audit/usage recording (mocked in tests).

4. **Phase 5D — Dashboard updates**
   - Surface employee, source app, and task type on dashboard and `/clients`.

## Out of scope for this sequence

- Removing or refactoring Slack code
- Source app API key auth (Phase 5E)
- Customer integration guide (Phase 5F)

## Constraints (all phases)

- No prompt/response text stored by default
- No direct paid provider calls in tests
- No secrets committed
- Slack integration must remain working
