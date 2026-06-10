# Phase 2 — Controlled Real Testing

## Phase 2 goal

Controlled real testing of Slack + LiteLLM integration while preserving the Step 1
privacy and architecture guarantees.

Step 1 established the mock/local pipeline (signed event simulation, in-process
queue, metadata-only storage, separate app/LiteLLM databases). Phase 2 validates
that pipeline against a real Slack app and one controlled LiteLLM provider call
before building dashboard spend cards.

## What stays mocked first

- Slack workspace can still use `T_DEMO` seed for local simulation.
- `npm run simulate:slack` remains available for local signed-event tests.
- Provider keys remain fake until the Slack route/interactivity flow is verified.
- Dashboard spend cards are not the first priority.

## What becomes real gradually

1. Real Slack app configuration.
2. Real Slack request URLs through ngrok or another tunnel.
3. Real Slack event subscription and interactivity.
4. Real Slack bot token and signing secret in local `.env`.
5. Real LiteLLM provider key configured only in LiteLLM environment/config.
6. One controlled successful LLM request.
7. Verify `AiUsageEvent`.
8. Verify `LiteLLM_SpendLogs`.
9. Verify metadata/tags.
10. Then build dashboard cards from `AiUsageEvent`.

## Phase 2 order of operations

```text
1. Create branch and mock credential template
2. Re-run Step 1 validation on the new branch
3. Configure real Slack app locally
4. Add ngrok/tunnel URLs:
   - /api/slack/events
   - /api/slack/interactivity
5. Verify Slack signature and fast ack with real Slack
6. Verify app_mention event reaches async worker
7. Verify unmapped channel assignment UI
8. Verify mapped channel reaches LiteLLM path
9. Add real provider key to LiteLLM only
10. Make one controlled successful LLM call
11. Verify AiUsageEvent was created
12. Verify LiteLLM_SpendLogs row was created
13. Verify metadata/tags are present
14. Only then build dashboard spend cards
```

## Required Slack scopes to verify later

Likely scopes (to be verified against channel types and bot behavior):

```text
chat:write
app_mentions:read
channels:history
groups:history
im:history
mpim:history
channels:read
groups:read
```

Exact scopes may change based on whether we support public channels, private
channels, DMs, and group DMs.

## Safety rules

```text
- Do not commit real secrets.
- Do not log Slack tokens.
- Do not log provider keys.
- Do not store prompt text by default.
- Do not store AI response text by default.
- Do not call LiteLLM directly from API routes.
- Keep Slack 200 OK ack fast.
- Real provider keys go only into LiteLLM/local secret config.
- App should only send metadata/tags to LiteLLM.
```

## Phase 2 success criteria

```text
- Real Slack event reaches /api/slack/events with verified signature.
- Real Slack interactivity reaches /api/slack/interactivity with verified signature.
- API routes return 2xx quickly.
- Mapped Slack request reaches background worker.
- LiteLLM call succeeds with real provider key.
- AiUsageEvent created without prompt/response text.
- LiteLLM_SpendLogs row exists.
- Metadata/tags include organization/client/project/workflow/source/app_request_id.
- No secrets are committed.
```

## Local credential template

Use `.env.phase2.example` as a placeholder template. Copy values into local
`.env` only — never commit real credentials.
